#!/usr/bin/env python3
import argparse
import os
import re
import sqlite3
from datetime import datetime
from html import escape
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    CondPageBreak,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = WORKSPACE_ROOT / "local.db"
DEFAULT_OUTPUT = WORKSPACE_ROOT / "output" / "pdf" / "isw-question-bank-correct-answers.pdf"
DEFAULT_PUBLIC_ROOT = WORKSPACE_ROOT / "public"


BLOCK_TAGS = {"address", "article", "aside", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "thead", "tfoot", "tr", "ul"}
CELL_TAGS = {"td", "th"}
SKIP_TAGS = {"script", "style", "noscript"}


class MoodleHtmlParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chunks = []
        self.buffer = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)

        if tag in SKIP_TAGS:
            self.skip_depth += 1
            return

        if self.skip_depth:
            return

        if tag == "img":
            self._flush_text()
            src = attrs_dict.get("src")
            if src:
                self.chunks.append(("image", src))
            return

        if tag == "br":
            self.buffer.append("\n")
            return

        if tag == "li":
            self.buffer.append("\n- ")
            return

        if tag in BLOCK_TAGS:
            self.buffer.append("\n")
            return

        if tag in CELL_TAGS:
            self.buffer.append(" | ")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1
            return

        if self.skip_depth:
            return

        if tag in BLOCK_TAGS or tag == "li":
            self.buffer.append("\n")
        elif tag in CELL_TAGS:
            self.buffer.append(" ")

    def handle_data(self, data):
        if not self.skip_depth:
            self.buffer.append(data)

    def close(self):
        super().close()
        self._flush_text()

    def _flush_text(self):
        text = clean_text("".join(self.buffer))
        if text:
            self.chunks.append(("text", text))
        self.buffer = []


def clean_text(value):
    if not value:
        return ""

    text = value.replace("\xa0", " ")
    text = text.replace("\u200b", "")
    text = re.sub(r"\bCorrect\.\s*", "", text)
    text = re.sub(r"\bIncorrect\.\s*", "", text)
    text = re.sub(r"\bRisposta corretta\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bRisposta errata\b", "", text, flags=re.IGNORECASE)

    cleaned_lines = []
    for line in text.splitlines():
        line = re.sub(r"[ \t\r\f\v]+", " ", line).strip()
        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def html_to_chunks(html, fallback_text):
    parser = MoodleHtmlParser()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        return [("text", clean_text(fallback_text))]

    if not parser.chunks:
        text = clean_text(fallback_text)
        return [("text", text)] if text else []

    return parser.chunks


def resolve_image_path(src, public_root):
    if not src:
        return None

    if src.startswith("file://"):
        path = Path(src.replace("file://", "", 1))
    elif src.startswith("/"):
        path = public_root / src.lstrip("/")
    else:
        path = public_root / src

    if path.exists() and path.is_file():
        return path
    return None


def image_flowable(path, max_width, max_height):
    try:
        with PILImage.open(path) as image:
            width, height = image.size
    except Exception:
        return None

    if width <= 0 or height <= 0:
        return None

    scale = min(max_width / width, max_height / height, 1.0)
    return Image(str(path), width=width * scale, height=height * scale)


def paragraph_from_text(text, style):
    text = clean_text(text)
    if not text:
        return None
    html = escape(text).replace("\n", "<br/>")
    return Paragraph(html, style)


def chunks_to_flowables(chunks, styles, public_root, max_width):
    flowables = []
    for kind, value in chunks:
        if kind == "text":
            paragraph = paragraph_from_text(value, styles["Body"])
            if paragraph:
                flowables.append(paragraph)
        elif kind == "image":
            path = resolve_image_path(value, public_root)
            if path:
                image = image_flowable(path, max_width=max_width, max_height=85 * mm)
                if image:
                    flowables.append(Spacer(1, 3))
                    flowables.append(image)
                    flowables.append(Spacer(1, 5))

    if not flowables:
        flowables.append(Paragraph("<i>Testo non disponibile.</i>", styles["Muted"]))

    return flowables


def fetch_questions(db_path, question_ids=None, flagged_only=False):
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        joins = ""
        conditions = []
        params = []

        if flagged_only:
            joins += " inner join question_flags qf on qf.question_id = q.id"

        if question_ids is not None:
            placeholders = ",".join("?" for _ in question_ids)
            conditions.append(f"q.id in ({placeholders})")
            params.extend(question_ids)

        where_clause = f" where {' and '.join(conditions)}" if conditions else ""

        questions = connection.execute(
            f"""
            select
                q.id,
                q.display_number,
                q.text_html,
                q.text_plain,
                coalesce(c.name, 'Senza categoria') as category_name,
                count(distinct qa.exam_id) as appearance_count
            from questions q
            left join categories c on c.id = q.primary_category_id
            left join question_appearances qa on qa.question_id = q.id
            {joins}
            {where_clause}
            group by q.id
            order by coalesce(q.display_number, 999999), q.created_at, q.id
            """,
            params,
        ).fetchall()

        result = []
        for question in questions:
            options = connection.execute(
                """
                select id, label, text_html, text_plain, is_correct, position
                from options
                where question_id = ?
                order by position, label, id
                """,
                (question["id"],),
            ).fetchall()
            result.append((question, options))
        return result
    finally:
        connection.close()


def build_styles():
    sample = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            textColor=colors.HexColor("#18212f"),
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#475569"),
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "QuestionTitle": ParagraphStyle(
            "QuestionTitle",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=4,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "Meta": ParagraphStyle(
            "Meta",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=7,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=12.5,
            textColor=colors.HexColor("#111827"),
            splitLongWords=1,
            spaceAfter=4,
        ),
        "OptionLabel": ParagraphStyle(
            "OptionLabel",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
        ),
        "CorrectLabel": ParagraphStyle(
            "CorrectLabel",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#166534"),
        ),
        "Muted": ParagraphStyle(
            "Muted",
            parent=sample["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#64748b"),
        ),
    }


def option_table(option, option_flowables, styles, doc_width):
    is_correct = bool(option["is_correct"])
    label = option["label"] or ""

    label_flowables = [Paragraph(escape(label.upper()), styles["OptionLabel"])]
    if is_correct:
        label_flowables.append(Paragraph("CORRETTA", styles["CorrectLabel"]))

    table = Table(
        [[label_flowables, option_flowables]],
        colWidths=[23 * mm, doc_width - (23 * mm)],
        hAlign="LEFT",
        splitByRow=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d8dee8")),
                ("LINEBEFORE", (1, 0), (1, 0), 0.6, colors.HexColor("#d8dee8")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eaf7ef") if is_correct else colors.white),
                ("BOX", (0, 0), (-1, -1), 1.0, colors.HexColor("#1f8a4c") if is_correct else colors.HexColor("#d8dee8")),
            ]
        )
    )
    return table


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(doc.leftMargin, 12 * mm, "Banca domande ISW")
    canvas.drawRightString(A4[0] - doc.rightMargin, 12 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_pdf(db_path, output_path, public_root, question_ids=None, flagged_only=False, title="Banca domande ISW"):
    data = fetch_questions(db_path, question_ids=question_ids, flagged_only=flagged_only)
    if not data:
        raise SystemExit("No questions matched the requested selection.")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=17 * mm,
        bottomMargin=19 * mm,
        title=title,
        author="ISW Quiz",
    )
    styles = build_styles()
    story = []

    total_questions = len(data)
    total_options = sum(len(options) for _, options in data)
    total_correct = sum(1 for _, options in data for option in options if option["is_correct"])
    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M")

    story.append(Spacer(1, 35 * mm))
    story.append(Paragraph(escape(title), styles["Title"]))
    story.append(
        Paragraph(
            f"{total_questions} domande - {total_options} risposte - {total_correct} risposte corrette evidenziate",
            styles["Subtitle"],
        )
    )
    story.append(Paragraph(f"Generato il {generated_at}", styles["Subtitle"]))
    story.append(Spacer(1, 10 * mm))
    story.append(
        Table(
            [[Paragraph("Le risposte corrette sono evidenziate in verde con l'etichetta CORRETTA.", styles["Body"])]],
            colWidths=[doc.width],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eaf7ef")),
                    ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#1f8a4c")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            ),
        )
    )
    story.append(PageBreak())

    for index, (question, options) in enumerate(data, start=1):
        display_number = question["display_number"] or index
        appearances = question["appearance_count"] or 0
        category = question["category_name"] or "Senza categoria"

        story.append(CondPageBreak(45 * mm))
        story.append(Paragraph(f"Domanda #{display_number}", styles["QuestionTitle"]))
        story.append(
            Paragraph(
                escape(f"Categoria: {category} | Comparse negli esami: {appearances} | ID interno: {question['id']}"),
                styles["Meta"],
            )
        )

        question_chunks = html_to_chunks(question["text_html"], question["text_plain"])
        story.extend(chunks_to_flowables(question_chunks, styles, public_root, max_width=doc.width))
        story.append(Spacer(1, 4))

        if not options:
            story.append(Paragraph("<i>Nessuna risposta disponibile.</i>", styles["Muted"]))
            continue

        for option in options:
            option_chunks = html_to_chunks(option["text_html"], option["text_plain"])
            option_flowables = chunks_to_flowables(
                option_chunks,
                styles,
                public_root,
                max_width=doc.width - (30 * mm),
            )
            story.append(option_table(option, option_flowables, styles, doc.width))
            story.append(Spacer(1, 5))

        story.append(Spacer(1, 8))

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return output_path


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a PDF with questions and highlighted correct answers.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output PDF path.")
    parser.add_argument("--public-root", default=str(DEFAULT_PUBLIC_ROOT), help="Public assets root.")
    parser.add_argument("--title", default="Banca domande ISW", help="Document title.")
    parser.add_argument("--flagged-only", action="store_true", help="Include only flagged questions.")
    parser.add_argument(
        "--ids-file",
        default=None,
        help="Path to a file with one question id per line; only these questions are included.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    db_path = Path(args.db).resolve()
    output_path = Path(args.output).resolve()
    public_root = Path(args.public_root).resolve()

    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")
    if not public_root.exists():
        raise SystemExit(f"Public root not found: {public_root}")

    question_ids = None
    if args.ids_file:
        ids_path = Path(args.ids_file).resolve()
        if not ids_path.exists():
            raise SystemExit(f"Ids file not found: {ids_path}")
        question_ids = [line.strip() for line in ids_path.read_text().splitlines() if line.strip()]
        if not question_ids:
            raise SystemExit("Ids file is empty.")

    pdf_path = build_pdf(
        db_path,
        output_path,
        public_root,
        question_ids=question_ids,
        flagged_only=args.flagged_only,
        title=args.title,
    )
    print(f"PDF generated: {pdf_path}")


if __name__ == "__main__":
    main()
