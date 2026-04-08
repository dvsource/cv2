"""GLM 5.1 LLM integration via OpenAI-compatible API."""

import json
import logging
import os

from openai import OpenAI

logger = logging.getLogger(__name__)

_client = None


class LLMError(Exception):
    """Raised when the LLM API call fails."""


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("GLM_API_KEY", "")
        if not api_key:
            raise ValueError("GLM_API_KEY environment variable is not set")
        _client = OpenAI(
            api_key=api_key,
            base_url="https://api.z.ai/api/coding/paas/v4",
        )
    return _client


_SYSTEM_PROMPT = """\
You are a job description analyser. Extract structured information from the provided content.

Return ONLY a valid JSON object with this exact shape:
{
  "company": "company name or empty string",
  "role": "job title/role or empty string",
  "description": "clean concise job description (2-3 sentences max) or empty string",
  "tech_skills": ["skill1", "skill2"],
  "other_skills": ["skill1", "skill2"],
  "key_points": ["point1", "point2", "point3"]
}

Rules:
- tech_skills: programming languages, frameworks, tools, cloud platforms, databases
- other_skills: soft skills, methodologies, domain knowledge, certifications
- key_points: important facts (years of experience required, remote/onsite, salary, team size, specific responsibilities)
- If extracting from raw pasted content (LinkedIn/job board page), fill company and role from the content
- If processing a structured form with description only, leave company and role as empty strings
- Return at most 8 items per list
- Return valid JSON only — no markdown fences, no explanation
"""


def _strip_fences(raw: str) -> str:
    """Strip markdown code fences if present (handles any language tag, any case)."""
    if not raw.startswith("```"):
        return raw
    lines = raw.splitlines()
    inner = lines[1:]  # drop opening fence line
    if inner and inner[-1].strip() == "```":
        inner = inner[:-1]  # drop closing fence line
    return "\n".join(inner).strip()


def extract_job_info(text: str, fill_company_role: bool = True) -> dict:
    """
    Call GLM 5.1 to extract structured job info from raw text.

    Args:
        text: raw pasted job page content OR structured description text
        fill_company_role: True when processing a raw paste (extract company+role);
                           False when processing a manual-entry description (skip those fields)

    Returns dict with keys: company, role, description, tech_skills, other_skills, key_points

    Raises:
        LLMError: if the API call fails for any reason
    """
    mode_hint = (
        "Extract company name, role/title, and all other fields from this raw job page content."
        if fill_company_role
        else "Extract only tech_skills, other_skills, and key_points from this job description. Leave company and role as empty strings."
    )

    try:
        response = _get_client().chat.completions.create(
            model="glm-5.1",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"{mode_hint}\n\n---\n\n{text}"},
            ],
            temperature=0.1,
            max_tokens=1200,
            timeout=30,
        )
    except Exception as exc:
        raise LLMError(str(exc)) from exc

    if not response.choices:
        raise LLMError("LLM returned empty choices")

    raw = response.choices[0].message.content.strip()
    raw = _strip_fences(raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON output: %r", raw[:200])
        result = {}

    return {
        "company": result.get("company", ""),
        "role": result.get("role", ""),
        "description": result.get("description", ""),
        "tech_skills": result.get("tech_skills", []),
        "other_skills": result.get("other_skills", []),
        "key_points": result.get("key_points", []),
    }
