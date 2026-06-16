from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup, Tag
from dotenv import load_dotenv
from playwright.async_api import Page, async_playwright


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_MEDIA_DIR = PROJECT_ROOT / "public" / "media" / "scraped"
DEFAULT_STORAGE_STATE = PROJECT_ROOT / "scraper" / "storage_state.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "raw" / "question-bank.json"
CATEGORIES_FILE = PROJECT_ROOT / "scraper" / "categories.json"
DEBUG_DIR = PROJECT_ROOT / "data" / "raw" / "debug"
URL_QUOTE_CHARS = "\"'`“”‘’"
ITALIAN_MONTHS = {
    "gennaio": 1,
    "febbraio": 2,
    "marzo": 3,
    "aprile": 4,
    "maggio": 5,
    "giugno": 6,
    "luglio": 7,
    "agosto": 8,
    "settembre": 9,
    "ottobre": 10,
    "novembre": 11,
    "dicembre": 12,
}

load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    description: str
    keywords: list[str]


def log(message: str) -> None:
    from datetime import datetime

    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "y"}


def env_int(name: str) -> int | None:
    value = os.getenv(name)
    if not value:
        return None
    if not value.isdigit():
        raise SystemExit(f"{name} must be an integer, got: {value}")
    return int(value)


def now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def normalize_text(value: str) -> str:
    value = BeautifulSoup(value, "lxml").get_text(" ", strip=True)
    value = re.sub(r"\s+", " ", value)
    return value.casefold().strip()


def html_to_plain(value: str) -> str:
    return BeautifulSoup(value, "lxml").get_text(" ", strip=True)


def compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def body_html(soup: BeautifulSoup) -> str:
    if soup.body:
        return soup.body.decode_contents()
    return str(soup)


def clean_option_html(option_node: Tag) -> str:
    soup = BeautifulSoup(str(option_node), "lxml")
    for selector in ["input", ".answernumber", ".accesshide", ".sr-only"]:
        for node in soup.select(selector):
            node.decompose()
    return body_html(soup)


def strip_url_fragment(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(fragment=""))


def clean_url(value: str) -> str:
    cleaned = value.strip().strip(URL_QUOTE_CHARS).strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SystemExit(
            "Invalid Moodle URL in MOODLE_QUIZ_URLS or --url. "
            f"Got: {value!r}. Use straight quotes, for example: "
            'MOODLE_QUIZ_URLS="https://elearning.uniroma1.it/mod/quiz/review.php?attempt=...&cmid=..."'
        )
    return cleaned


def is_show_all_review_url(url: str) -> bool:
    query = parse_qs(urlparse(url).query)
    return query.get("showall", [""])[0].lower() in {"1", "true", "yes"}


def show_all_review_url(url: str) -> str:
    parsed = urlparse(strip_url_fragment(url))
    if "review.php" not in parsed.path:
        return strip_url_fragment(url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query.pop("page", None)
    query["showall"] = ["1"]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True), fragment=""))


def review_page_url(url: str, page_number: int) -> str:
    parsed = urlparse(strip_url_fragment(url))
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page_number)]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True), fragment=""))


def canonical_review_url(url: str) -> str:
    parsed = urlparse(strip_url_fragment(url))
    query = parse_qs(parsed.query, keep_blank_values=True)
    if query.get("page", [""])[0] == "0" or is_show_all_review_url(url):
        query.pop("page", None)
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True), fragment=""))


def stable_exam_source(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    stable_params: dict[str, str] = {}

    for key in ["id", "cmid", "course", "quiz"]:
        if query.get(key):
            stable_params[key] = query[key][0]

    if not stable_params and query.get("attempt"):
        stable_params["attempt"] = query["attempt"][0]

    return urlunparse(
        parsed._replace(
            query=urlencode(stable_params),
            fragment="",
        )
    )


def parse_exam_date(value: str) -> str | None:
    normalized = compact_text(value).casefold()

    year_first = re.search(r"\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b", normalized)
    if year_first:
        year, month, day = (int(part) for part in year_first.groups())
        return f"{year:04d}-{month:02d}-{day:02d}"

    day_first = re.search(r"\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b", normalized)
    if day_first:
        day, month = (int(part) for part in day_first.groups()[:2])
        year = int(day_first.group(3))
        if year < 100:
            year += 2000
        return f"{year:04d}-{month:02d}-{day:02d}"

    month_names = "|".join(ITALIAN_MONTHS)
    named_month = re.search(rf"\b(0?[1-9]|[12]\d|3[01])\s+({month_names})\s+(20\d{{2}})\b", normalized)
    if named_month:
        day = int(named_month.group(1))
        month = ITALIAN_MONTHS[named_month.group(2)]
        year = int(named_month.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"

    return None


def normalize_exam_title(value: str, fallback: str) -> str:
    title = compact_text(value)
    title = re.sub(r"\b(revisione|review)\b.*$", "", title, flags=re.IGNORECASE).strip(" -–—:|")
    if not title or title.casefold() == "moodle sapienza":
        return fallback
    return title


def extract_exam_metadata(html: str, current_url: str, page_title: str) -> dict[str, str | None]:
    soup = BeautifulSoup(html, "lxml")
    candidates: list[str] = []

    for selector in [
        "nav[aria-label*='breadcrumb']",
        ".breadcrumb",
        "#page-navbar",
        ".page-header-headings",
        ".page-context-header",
        "h1",
        "h2",
        "h3",
        "title",
    ]:
        for node in soup.select(selector):
            text = compact_text(node.get_text(" ", strip=True))
            if text:
                candidates.append(text)

    if page_title:
        candidates.append(compact_text(page_title))

    expanded_candidates: list[str] = []
    for candidate in candidates:
        expanded_candidates.append(candidate)
        expanded_candidates.extend(
            compact_text(part)
            for part in re.split(r"\s*(?:›|/|»|\||–|—)\s*", candidate)
            if compact_text(part)
        )

    dated_candidates = [(candidate, parse_exam_date(candidate)) for candidate in expanded_candidates]
    dated_candidates = [(candidate, date) for candidate, date in dated_candidates if date]
    fallback = f"Esame {urlparse(current_url).query or sha256_text(current_url)[:8]}"

    if dated_candidates:
        candidate, date = max(dated_candidates, key=lambda item: len(item[0]))
        return {
            "title": f"Esame {date}",
            "date": date,
        }

    useful_candidates = [
        candidate
        for candidate in expanded_candidates
        if candidate.casefold() != "moodle sapienza"
        and re.search(r"\b(esame|appello|quiz|prova|ingegneria del software)\b", candidate, re.IGNORECASE)
    ]
    if useful_candidates:
        return {"title": normalize_exam_title(useful_candidates[-1], fallback), "date": None}

    return {"title": fallback, "date": None}


def load_categories() -> list[Category]:
    raw = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))
    return [Category(**item) for item in raw]


def classify_question(text: str, categories: list[Category]) -> list[dict[str, Any]]:
    normalized = normalize_text(text)
    predictions: list[dict[str, Any]] = []

    for category in categories:
        matches = 0
        for keyword in category.keywords:
            if keyword.casefold() in normalized:
                matches += 1

        if matches:
            confidence = min(0.95, 0.55 + matches * 0.12)
            predictions.append(
                {
                    "categoryId": category.id,
                    "confidence": round(confidence, 2),
                    "method": "keyword",
                }
            )

    return sorted(predictions, key=lambda item: item["confidence"], reverse=True)


def image_extension(url: str, content_type: str | None) -> str:
    if content_type:
        if "png" in content_type:
            return ".png"
        if "jpeg" in content_type or "jpg" in content_type:
            return ".jpg"
        if "gif" in content_type:
            return ".gif"
        if "webp" in content_type:
            return ".webp"
        if "svg" in content_type:
            return ".svg"

    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        return suffix
    return ".png"


async def download_image(page: Page, source: str, base_url: str) -> dict[str, str]:
    PUBLIC_MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    if source.startswith("data:"):
        header, encoded = source.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "")
        content = base64.b64decode(encoded)
        original_url = source[:80]
    else:
        absolute_url = urljoin(base_url, source)
        response = await page.context.request.get(
            absolute_url,
            headers={
                "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "referer": base_url,
            },
        )
        if response.ok:
            content = await response.body()
            content_type = response.headers.get("content-type")
        else:
            content, content_type = await fetch_image_in_browser(page, absolute_url)
        original_url = absolute_url

    digest = sha256_bytes(content)
    ext = image_extension(original_url, content_type)
    filename = f"{digest[:24]}{ext}"
    disk_path = PUBLIC_MEDIA_DIR / filename
    if not disk_path.exists():
        disk_path.write_bytes(content)

    return {
        "id": f"img_{digest[:16]}",
        "originalUrl": original_url,
        "localPath": f"/media/scraped/{filename}",
        "sha256": f"sha256:{digest}",
    }


async def fetch_image_in_browser(page: Page, absolute_url: str) -> tuple[bytes, str | None]:
    result = await page.evaluate(
        """
        async ({ url }) => {
          const response = await fetch(url, {
            credentials: "include",
            headers: { "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }
          });
          if (!response.ok) {
            return { ok: false, status: response.status, contentType: response.headers.get("content-type") };
          }
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          const chunkSize = 32768;
          for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
          }
          return {
            ok: true,
            base64: btoa(binary),
            contentType: response.headers.get("content-type")
          };
        }
        """,
        {"url": absolute_url},
    )
    if not result["ok"]:
        raise RuntimeError(f"Image download failed ({result['status']}): {absolute_url}")
    return base64.b64decode(result["base64"]), result.get("contentType")


async def rewrite_images(page: Page, html: str, base_url: str) -> tuple[str, list[dict[str, str]]]:
    soup = BeautifulSoup(html, "lxml")
    images: list[dict[str, str]] = []

    for image in soup.find_all("img"):
        if not isinstance(image, Tag):
            continue
        source = image.get("src")
        if not source:
            continue
        try:
            asset = await download_image(page, source, base_url)
        except Exception as error:
            log(f"Warning: skipped image {urljoin(base_url, source)} ({error})")
            continue
        asset["alt"] = image.get("alt", "")
        image["src"] = asset["localPath"]
        images.append(asset)
        log(f"Image saved: {asset['localPath']}")

    return body_html(soup), images


def extract_exam_id(url: str, title: str) -> str:
    digest = sha256_text(stable_exam_source(url))[:10]
    if "uniroma1.it" in urlparse(url).netloc:
        return f"moodle-sapienza-{digest}"

    normalized = re.sub(r"[^a-z0-9]+", "-", title.casefold()).strip("-")
    if normalized:
        return f"{normalized[:48]}-{digest}"
    return f"exam-{digest}"


def element_is_correct(node: Tag) -> bool:
    candidates = [node, *node.find_all(True)]
    for candidate in candidates:
        classes = candidate.get("class") or []
        if any(str(css_class).casefold() in {"correct", "rightanswer"} for css_class in classes):
            return True
    return False


def correct_answer_texts(container: Tag) -> set[str]:
    values: set[str] = set()
    for node in container.select(".rightanswer"):
        text = node.get_text(" ", strip=True)
        if ":" in text:
            text = text.split(":", 1)[1]
        for part in re.split(r"\s*(?:;|\n)\s*", text):
            normalized = normalize_text(part)
            if normalized:
                values.add(normalized)
    return values


def option_nodes(container: Tag) -> list[Tag]:
    answer_root = container.select_one(".answer")
    if not answer_root:
        return []

    direct_nodes = [node for node in answer_root.select(":scope > div") if isinstance(node, Tag)]
    if direct_nodes:
        return direct_nodes

    return [node for node in answer_root.select(".r0, .r1") if isinstance(node, Tag)]


async def parse_question(
    page: Page,
    container: Tag,
    base_url: str,
    exam_id: str,
    question_number: int,
    categories: list[Category],
) -> dict[str, Any] | None:
    question_text_node = container.select_one(".qtext") or container.select_one(".formulation")
    if not question_text_node:
        return None

    question_html, question_images = await rewrite_images(
        page,
        question_text_node.decode_contents(),
        base_url,
    )
    question_plain = html_to_plain(question_html)
    known_correct_texts = correct_answer_texts(container)

    parsed_options: list[dict[str, Any]] = []
    for raw_index, node in enumerate(option_nodes(container)):
        cleaned_html = clean_option_html(node)
        option_html, option_images = await rewrite_images(page, cleaned_html, base_url)
        option_plain = html_to_plain(option_html)
        if not option_plain:
            continue
        normalized_option = normalize_text(option_plain)
        parsed_options.append(
            {
                "rawIndex": raw_index,
                "textHtml": option_html,
                "textPlain": option_plain,
                "images": option_images,
                "isCorrect": element_is_correct(node) or normalized_option in known_correct_texts,
                "normalized": normalized_option,
            }
        )

    if len(parsed_options) < 2:
        return None

    if not any(option["isCorrect"] for option in parsed_options):
        return None

    canonical_payload = {
        "question": normalize_text(question_plain),
        "options": sorted(option["normalized"] for option in parsed_options),
        "correct": sorted(option["normalized"] for option in parsed_options if option["isCorrect"]),
    }
    digest = sha256_text(json.dumps(canonical_payload, ensure_ascii=False, sort_keys=True))
    question_id = f"q_{digest[:16]}"

    normalized_options = sorted({option["normalized"] for option in parsed_options})
    option_id_by_text = {
        normalized: f"{question_id}_{chr(97 + index)}"
        for index, normalized in enumerate(normalized_options)
    }

    canonical_options: list[dict[str, Any]] = []
    for normalized in normalized_options:
        first_match = next(option for option in parsed_options if option["normalized"] == normalized)
        canonical_options.append(
            {
                "id": option_id_by_text[normalized],
                "textHtml": first_match["textHtml"],
                "textPlain": first_match["textPlain"],
                "images": first_match["images"],
                "isCorrect": first_match["isCorrect"],
            }
        )

    timestamp = now_iso()
    return {
        "id": question_id,
        "canonicalHash": f"sha256:{digest}",
        "textHtml": question_html,
        "textPlain": question_plain,
        "images": question_images,
        "options": canonical_options,
        "explanationHtml": None,
        "categoryPredictions": classify_question(question_plain, categories),
        "appearances": [
            {
                "examId": exam_id,
                "questionNumber": question_number,
                "optionOrder": [option_id_by_text[option["normalized"]] for option in parsed_options],
            }
        ],
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }


def discover_review_page_count(soup: BeautifulSoup) -> int | None:
    scoped_nodes = soup.select(
        "#mod_quiz_navblock, .block_quiz_navblock, .qn_buttons, .qnbutton, [aria-label*='Navigazione quiz']"
    )
    search_roots: list[BeautifulSoup | Tag] = scoped_nodes if scoped_nodes else [soup]
    numbers: set[int] = set()

    for root in search_roots:
        for anchor in root.find_all("a", href=True):
            if not isinstance(anchor, Tag):
                continue
            href = anchor.get("href") or ""
            if "review.php" not in href:
                continue
            text = anchor.get_text(" ", strip=True)
            if text.isdigit():
                numbers.add(int(text))

    if numbers:
        return max(numbers)
    return None


def discover_review_page_urls(html: str, current_url: str, page_count: int | None = None) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    current = canonical_review_url(current_url)
    current_query = parse_qs(urlparse(current).query)
    current_attempt = current_query.get("attempt", [None])[0]
    urls: set[str] = set()

    if is_show_all_review_url(current):
        return [current]

    if soup.select(".que"):
        urls.add(current)

    for anchor in soup.find_all("a", href=True):
        if not isinstance(anchor, Tag):
            continue
        href = anchor.get("href")
        if not href:
            continue
        absolute = canonical_review_url(urljoin(current_url, href))
        parsed = urlparse(absolute)
        if "review.php" not in parsed.path:
            continue
        query = parse_qs(parsed.query)
        if current_attempt and query.get("attempt", [None])[0] != current_attempt:
            continue
        urls.add(absolute)

    generated_page_count = page_count or discover_review_page_count(soup)
    parsed_current = urlparse(current)
    if generated_page_count and "review.php" in parsed_current.path and current_attempt:
        for page_number in range(generated_page_count):
            urls.add(canonical_review_url(review_page_url(current, page_number)))

    def page_order(value: str) -> tuple[int, str]:
        query = parse_qs(urlparse(value).query)
        page_value = query.get("page", ["0"])[0]
        if page_value.isdigit():
            return (int(page_value), value)
        return (9999, value)

    return sorted(urls, key=page_order)


async def save_debug_page(page: Page, reason: str) -> None:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    current_url = await page.evaluate("location.href")
    stem = f"{re.sub(r'[^a-z0-9-]+', '-', reason.casefold()).strip('-')}-{sha256_text(current_url)[:10]}"
    html_path = DEBUG_DIR / f"{stem}.html"
    screenshot_path = DEBUG_DIR / f"{stem}.png"
    html_path.write_text(await page.content(), encoding="utf-8")
    try:
        await page.screenshot(path=str(screenshot_path), full_page=True)
        log(f"Debug page saved: {html_path} and {screenshot_path}")
    except Exception:
        log(f"Debug page saved: {html_path}")


async def scrape_exam(
    page: Page,
    url: str,
    categories: list[Category],
    page_count: int | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    log(f"Opening review URL: {url}")
    await page.goto(url, wait_until="domcontentloaded")
    html = await page.content()
    soup = BeautifulSoup(html, "lxml")

    page_title = soup.select_one("h1")
    title = page_title.get_text(" ", strip=True) if page_title else await page.title()
    metadata = extract_exam_metadata(html, page.url, await page.title())
    title = metadata["title"] or title
    exam_id = extract_exam_id(url, title)
    review_urls = discover_review_page_urls(html, page.url, page_count)
    pending_urls = review_urls or [page.url]
    seen_urls: set[str] = set()

    log(f"Review title: {title or url}")
    log(f"Review pages queued: {len(pending_urls)}")

    questions: list[dict[str, Any]] = []
    parsed_containers = 0

    while pending_urls:
        current_url = pending_urls.pop(0)
        if current_url in seen_urls:
            continue
        seen_urls.add(current_url)

        log(f"Scraping review page {len(seen_urls)}/{len(seen_urls) + len(pending_urls)}: {current_url}")
        await page.goto(current_url, wait_until="domcontentloaded")
        current_html = await page.content()
        for discovered_url in discover_review_page_urls(current_html, page.url, page_count):
            if discovered_url not in seen_urls and discovered_url not in pending_urls:
                pending_urls.append(discovered_url)

        current_soup = BeautifulSoup(current_html, "lxml")
        containers = [node for node in current_soup.select(".que") if isinstance(node, Tag)]
        parsed_containers += len(containers)
        log(f"Found {len(containers)} Moodle question blocks on this page")

        page_imported = 0
        page_skipped = 0
        for local_index, container in enumerate(containers, start=1):
            next_question_number = len(questions) + 1
            log(f"Parsing question block {local_index}/{len(containers)} as question {next_question_number}")
            question = await parse_question(page, container, current_url, exam_id, len(questions) + 1, categories)
            if question:
                questions.append(question)
                page_imported += 1
                image_count = len(question["images"]) + sum(len(option["images"]) for option in question["options"])
                correct_count = sum(1 for option in question["options"] if option["isCorrect"])
                category = question["categoryPredictions"][0]["categoryId"] if question["categoryPredictions"] else "uncategorized"
                log(
                    "Imported question "
                    f"{len(questions)}: {len(question['options'])} options, "
                    f"{correct_count} correct, {image_count} images, category={category}"
                )
            else:
                page_skipped += 1
                log(f"Skipped question block {local_index}/{len(containers)}: no usable corrected answer detected")
        log(f"Page done: {page_imported} imported, {page_skipped} skipped")

    if parsed_containers == 0:
        log(
            "No Moodle question blocks found. "
            "If this is the quiz start page, use `npm run scraper:review` and navigate manually to the correction/review page."
        )
        await save_debug_page(page, "no-question-blocks")
    elif not questions:
        log(
            "Question blocks were found, but no corrected answers were detected. "
            "This usually means Moodle is showing an attempt page, not the correction/review page."
        )
        await save_debug_page(page, "no-correct-answers")

    log(f"Review done: {len(questions)} imported questions from {parsed_containers} Moodle blocks")

    exam = {
        "id": exam_id,
        "title": title or url,
        "sourceUrl": stable_exam_source(url),
        "date": metadata["date"],
    }
    return exam, questions


def merge_question(existing: dict[str, Any], incoming: dict[str, Any]) -> None:
    known_exam_ids = {appearance["examId"] for appearance in existing["appearances"]}
    for appearance in incoming["appearances"]:
        if appearance["examId"] not in known_exam_ids:
            existing["appearances"].append(appearance)
    existing["updatedAt"] = now_iso()


def build_question_bank(
    categories: list[Category],
    exams: dict[str, dict[str, Any]],
    question_by_hash: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        "version": 1,
        "exams": list(exams.values()),
        "categories": [
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "keywords": category.keywords,
            }
            for category in categories
        ],
        "questions": list(question_by_hash.values()),
    }


def write_question_bank(
    output: Path,
    categories: list[Category],
    exams: dict[str, dict[str, Any]],
    question_by_hash: dict[str, dict[str, Any]],
) -> None:
    bank = build_question_bank(categories, exams, question_by_hash)
    output.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")


async def login(args: argparse.Namespace) -> None:
    login_url = args.login_url or os.getenv("MOODLE_LOGIN_URL")
    if not login_url:
        raise SystemExit("Missing MOODLE_LOGIN_URL")

    storage_state = Path(args.storage_state or os.getenv("SCRAPER_STORAGE_STATE") or DEFAULT_STORAGE_STATE)
    storage_state.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(login_url)

        username = os.getenv("MOODLE_USERNAME")
        password = os.getenv("MOODLE_PASSWORD")
        if username and password:
            await page.locator("input[name='username'], #username").first.fill(username)
            await page.locator("input[name='password'], #password").first.fill(password)
            await page.locator("button[type='submit'], input[type='submit']").first.click()

        await asyncio.to_thread(input, "Completa il login Moodle nel browser, poi premi Invio qui...")
        await context.storage_state(path=str(storage_state))
        await browser.close()
        print(f"Session saved to {storage_state}")


async def scrape(args: argparse.Namespace) -> None:
    urls = read_quiz_urls(args.url)

    if not urls:
        raise SystemExit("Missing quiz URLs. Use --url or MOODLE_QUIZ_URLS.")

    output = Path(args.output or os.getenv("SCRAPER_OUTPUT") or DEFAULT_OUTPUT)
    output.parent.mkdir(parents=True, exist_ok=True)

    storage_state = Path(args.storage_state or os.getenv("SCRAPER_STORAGE_STATE") or DEFAULT_STORAGE_STATE)
    page_count = args.pages or env_int("MOODLE_REVIEW_PAGE_COUNT")
    categories = load_categories()
    question_by_hash: dict[str, dict[str, Any]] = {}
    exams: dict[str, dict[str, Any]] = {}

    log("Starting Moodle scrape")
    log(f"Review URLs loaded: {len(urls)}")
    log(f"Show-all conversion: {env_bool('MOODLE_REVIEW_SHOW_ALL', False)}")
    log(f"Expected paginated page count: {page_count if page_count else 'auto'}")
    log(f"Output file: {output}")
    log(f"Storage state: {storage_state} ({'found' if storage_state.exists() else 'not found'})")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=env_bool("SCRAPER_HEADLESS", True))
        context_kwargs: dict[str, Any] = {}
        if storage_state.exists():
            context_kwargs["storage_state"] = str(storage_state)
        context = await browser.new_context(**context_kwargs)
        page = await context.new_page()

        failed_urls: list[str] = []
        for index, url in enumerate(urls, start=1):
            log(f"=== Review {index}/{len(urls)} ===")
            before_unique_count = len(question_by_hash)
            try:
                exam, questions = await scrape_exam(page, url, categories, page_count)
            except Exception as error:
                failed_urls.append(url)
                log(f"Error scraping {url}: {error}")
                continue
            exams[exam["id"]] = exam
            for question in questions:
                existing = question_by_hash.get(question["canonicalHash"])
                if existing:
                    merge_question(existing, question)
                else:
                    question_by_hash[question["canonicalHash"]] = question
            write_question_bank(output, categories, exams, question_by_hash)
            new_unique_count = len(question_by_hash) - before_unique_count
            duplicate_count = max(0, len(questions) - new_unique_count)
            log(
                f"Review {index}/{len(urls)} merged: "
                f"{len(questions)} extracted, {new_unique_count} new unique, "
                f"{duplicate_count} duplicates/known"
            )
            log(f"Checkpoint saved: {len(question_by_hash)} unique questions -> {output}")

        await browser.close()

    write_question_bank(output, categories, exams, question_by_hash)
    log(f"Wrote {len(question_by_hash)} unique questions to {output}")
    if failed_urls:
        log("Some URLs failed:")
        for failed_url in failed_urls:
            log(f"- {failed_url}")


def read_quiz_urls(cli_urls: list[str] | None) -> list[str]:
    urls = cli_urls or []
    env_urls = os.getenv("MOODLE_QUIZ_URLS", "")
    urls.extend([url.strip() for url in env_urls.split(",") if url.strip()])
    cleaned_urls = [clean_url(url) for url in urls if url.strip()]
    if env_bool("MOODLE_REVIEW_SHOW_ALL", False):
        cleaned_urls = [show_all_review_url(url) for url in cleaned_urls]
        log("Converted Moodle review URLs to showall=1 where possible")
    return list(dict.fromkeys(cleaned_urls))


async def scrape_review(args: argparse.Namespace) -> None:
    urls = read_quiz_urls(args.url)

    if not urls:
        raise SystemExit("Missing quiz URLs. Use --url or MOODLE_QUIZ_URLS.")

    output = Path(args.output or os.getenv("SCRAPER_OUTPUT") or DEFAULT_OUTPUT)
    output.parent.mkdir(parents=True, exist_ok=True)

    storage_state = Path(args.storage_state or os.getenv("SCRAPER_STORAGE_STATE") or DEFAULT_STORAGE_STATE)
    page_count = args.pages or env_int("MOODLE_REVIEW_PAGE_COUNT")
    categories = load_categories()
    question_by_hash: dict[str, dict[str, Any]] = {}
    exams: dict[str, dict[str, Any]] = {}
    failed_urls: list[str] = []

    log("Starting guided Moodle review scrape")
    log(f"Review URLs loaded: {len(urls)}")
    log(f"Expected paginated page count: {page_count if page_count else 'auto'}")
    log(f"Output file: {output}")
    log(f"Storage state: {storage_state} ({'found' if storage_state.exists() else 'not found'})")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        context_kwargs: dict[str, Any] = {}
        if storage_state.exists():
            context_kwargs["storage_state"] = str(storage_state)
        context = await browser.new_context(**context_kwargs)
        page = await context.new_page()

        for index, url in enumerate(urls, start=1):
            log(f"=== Guided review {index}/{len(urls)} ===")
            await page.goto(url, wait_until="domcontentloaded")
            log(f"Opened: {url}")
            log("Nel browser completa il flusso Moodle fino alla pagina di correzione/review.")
            log("Quando vedi le risposte corrette, torna qui e premi Invio.")
            await asyncio.to_thread(input)

            current_url = await page.evaluate("location.href")
            before_unique_count = len(question_by_hash)
            try:
                exam, questions = await scrape_exam(page, current_url, categories, page_count)
            except Exception as error:
                failed_urls.append(current_url)
                log(f"Error scraping {current_url}: {error}")
                continue
            exams[exam["id"]] = exam
            for question in questions:
                existing = question_by_hash.get(question["canonicalHash"])
                if existing:
                    merge_question(existing, question)
                else:
                    question_by_hash[question["canonicalHash"]] = question
            write_question_bank(output, categories, exams, question_by_hash)
            new_unique_count = len(question_by_hash) - before_unique_count
            duplicate_count = max(0, len(questions) - new_unique_count)
            log(
                f"Guided review {index}/{len(urls)} merged: "
                f"{len(questions)} extracted, {new_unique_count} new unique, "
                f"{duplicate_count} duplicates/known"
            )
            log(f"Checkpoint saved: {len(question_by_hash)} unique questions -> {output}")

        await context.storage_state(path=str(storage_state))
        await browser.close()

    write_question_bank(output, categories, exams, question_by_hash)
    log(f"Wrote {len(question_by_hash)} unique corrected questions to {output}")
    if failed_urls:
        log("Some URLs failed:")
        for failed_url in failed_urls:
            log(f"- {failed_url}")


async def refresh_metadata(args: argparse.Namespace) -> None:
    urls = read_quiz_urls(args.url)

    if not urls:
        raise SystemExit("Missing quiz URLs. Use --url or MOODLE_QUIZ_URLS.")

    output = Path(args.output or os.getenv("SCRAPER_OUTPUT") or DEFAULT_OUTPUT)
    if not output.exists():
        raise SystemExit(f"Question bank not found: {output}")

    storage_state = Path(args.storage_state or os.getenv("SCRAPER_STORAGE_STATE") or DEFAULT_STORAGE_STATE)
    bank = json.loads(output.read_text(encoding="utf-8"))
    exams_by_source = {
        exam.get("sourceUrl"): exam
        for exam in bank.get("exams", [])
        if isinstance(exam, dict) and exam.get("sourceUrl")
    }
    updated = 0
    missing_sources: list[str] = []

    log("Starting Moodle exam metadata refresh")
    log(f"Review URLs loaded: {len(urls)}")
    log(f"Question bank: {output}")
    log(f"Storage state: {storage_state} ({'found' if storage_state.exists() else 'not found'})")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=env_bool("SCRAPER_HEADLESS", True))
        context_kwargs: dict[str, Any] = {}
        if storage_state.exists():
            context_kwargs["storage_state"] = str(storage_state)
        context = await browser.new_context(**context_kwargs)
        page = await context.new_page()

        for index, url in enumerate(urls, start=1):
            log(f"=== Metadata {index}/{len(urls)} ===")
            await page.goto(url, wait_until="domcontentloaded")
            html = await page.content()
            metadata = extract_exam_metadata(html, page.url, await page.title())
            source_url = stable_exam_source(url)
            exam = exams_by_source.get(source_url)
            if not exam:
                missing_sources.append(source_url)
                log(f"No existing exam matched sourceUrl={source_url}")
                continue

            previous_title = exam.get("title")
            previous_date = exam.get("date")
            exam["title"] = metadata["title"] or previous_title
            exam["date"] = metadata["date"] or previous_date
            updated += 1
            log(f"Updated exam: {previous_title!r} -> {exam['title']!r}, date={exam.get('date')}")

        await browser.close()

    output.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"Metadata refresh done: {updated} exams updated in {output}")
    if missing_sources:
        log("Some source URLs were not found in the existing question bank:")
        for source_url in missing_sources:
            log(f"- {source_url}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape Moodle quiz questions into ISW question-bank JSON.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    login_parser = subparsers.add_parser("login", help="Open Moodle and save an authenticated session.")
    login_parser.add_argument("--login-url")
    login_parser.add_argument("--storage-state")

    scrape_parser = subparsers.add_parser("scrape", help="Scrape one or more Moodle quiz/review pages.")
    scrape_parser.add_argument("--url", action="append", help="Quiz/review URL. Can be repeated.")
    scrape_parser.add_argument("--output")
    scrape_parser.add_argument("--storage-state")
    scrape_parser.add_argument("--pages", type=int, help="Expected number of review pages/questions, e.g. 50.")

    review_parser = subparsers.add_parser(
        "review",
        help="Open each quiz URL and wait while you manually reach the Moodle correction/review page.",
    )
    review_parser.add_argument("--url", action="append", help="Quiz URL. Can be repeated.")
    review_parser.add_argument("--output")
    review_parser.add_argument("--storage-state")
    review_parser.add_argument("--pages", type=int, help="Expected number of review pages/questions, e.g. 50.")

    metadata_parser = subparsers.add_parser(
        "metadata",
        help="Refresh exam title/date metadata in the existing question-bank JSON without re-scraping questions.",
    )
    metadata_parser.add_argument("--url", action="append", help="Quiz/review URL. Can be repeated.")
    metadata_parser.add_argument("--output")
    metadata_parser.add_argument("--storage-state")

    return parser


async def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "login":
        await login(args)
    elif args.command == "scrape":
        await scrape(args)
    elif args.command == "review":
        await scrape_review(args)
    elif args.command == "metadata":
        await refresh_metadata(args)


if __name__ == "__main__":
    asyncio.run(main())
