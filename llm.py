"""GLM 5.1 LLM integration via OpenAI-compatible API."""

import json
import os

from openai import OpenAI

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("GLM_API_KEY", "")
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


def extract_job_info(text: str, fill_company_role: bool = True) -> dict:
    """
    Call GLM 5.1 to extract structured job info from raw text.

    Args:
        text: raw pasted job page content OR structured description text
        fill_company_role: True when processing a raw paste (extract company+role);
                           False when processing a manual-entry description (skip those fields)

    Returns dict with keys: company, role, description, tech_skills, other_skills, key_points
    """
    mode_hint = (
        "Extract company name, role/title, and all other fields from this raw job page content."
        if fill_company_role
        else "Extract only tech_skills, other_skills, and key_points from this job description. Leave company and role as empty strings."
    )

    response = _get_client().chat.completions.create(
        model="glm-5.1",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"{mode_hint}\n\n---\n\n{text}"},
        ],
        temperature=0.1,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if the model includes them despite instructions
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

    return {
        "company": result.get("company", ""),
        "role": result.get("role", ""),
        "description": result.get("description", ""),
        "tech_skills": result.get("tech_skills", []),
        "other_skills": result.get("other_skills", []),
        "key_points": result.get("key_points", []),
    }
