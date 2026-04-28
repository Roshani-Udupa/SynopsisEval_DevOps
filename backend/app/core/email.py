"""
Email dispatcher for real SMTP delivery and portal-branded templates.
"""
import asyncio
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from html import escape
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("synopsis.email")


async def send_email(
    to_address: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """Send a single email through the configured SMTP server."""

    if not settings.SMTP_ENABLED:
        logger.error("SMTP is disabled. Set SMTP_ENABLED=true to send real mail.")
        return False

    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.error("SMTP is enabled but SMTP_USERNAME / SMTP_PASSWORD are not set.")
        return False

    from_address = settings.EMAIL_FROM_ADDRESS or settings.SMTP_USERNAME
    from_name = settings.EMAIL_FROM_NAME or settings.APP_NAME

    if not from_address:
        logger.error("SMTP sender address is not configured.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_address))
    msg["To"] = to_address

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    def _deliver() -> None:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(from_address, [to_address], msg.as_string())

    try:
        await asyncio.to_thread(_deliver)
        logger.info("Email sent to %s — Subject: %s", to_address, subject)
        return True

    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_address, exc)
        return False


async def send_bulk_email(
    addresses: list[str],
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> dict:
    """Send to multiple addresses. Returns {sent: n, failed: n}."""
    unique_addresses = list(dict.fromkeys(addr for addr in addresses if addr))
    results = await asyncio.gather(
        *(send_email(addr, subject, html_body, text_body) for addr in unique_addresses),
        return_exceptions=True,
    )
    sent = sum(1 for result in results if result is True)
    failed = len(results) - sent
    return {"sent": sent, "failed": failed}


# ── Email Templates ────────────────────────────────────────────────────────

def _base_template(title: str, content: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: 'DM Sans', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }}
    .wrapper {{ max-width: 560px; margin: 40px auto; background: #fff;
                border-radius: 16px; border: 1px solid #e5e7eb;
                box-shadow: 0 4px 24px rgba(0,0,0,.06); overflow: hidden; }}
    .header  {{ background: #2563eb; padding: 28px 32px; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 20px; font-weight: 700; }}
    .header p  {{ color: #bfdbfe; margin: 4px 0 0; font-size: 13px; }}
    .body    {{ padding: 32px; color: #374151; font-size: 15px; line-height: 1.7; }}
    .body h2 {{ font-size: 18px; color: #111827; margin-top: 0; }}
    .btn     {{ display: inline-block; margin: 20px 0; padding: 12px 28px;
                background: #2563eb; color: #fff !important; text-decoration: none;
                border-radius: 10px; font-weight: 600; font-size: 14px; }}
    .footer  {{ background: #f9fafb; border-top: 1px solid #e5e7eb;
                padding: 16px 32px; color: #9ca3af; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📄 Synopsis Review Portal</h1>
            <p>{escape(title)}</p>
    </div>
    <div class="body">{content}</div>
    <div class="footer">
      This is an automated message. Please do not reply directly to this email.<br/>
      © 2024 Synopsis Review Portal. Academic Use Only.
    </div>
  </div>
</body>
</html>
"""


def password_reset_email(reset_url: str, user_name: str) -> tuple[str, str]:
    """Returns (subject, html_body)."""
    subject = "Reset Your Synopsis Portal Password"
    html = _base_template(
        "Password Reset Request",
        f"""
                <h2>Hi {escape(user_name)},</h2>
        <p>We received a request to reset the password for your Synopsis Review Portal account.</p>
        <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
                <a href="{escape(reset_url, quote=True)}" class="btn">Reset Password</a>
        <p>If you did not request a password reset, you can safely ignore this email —
           your account has not been changed.</p>
        <p style="font-size:13px;color:#6b7280;">
          Or copy this link into your browser:<br/>
                    <code style="word-break:break-all;">{escape(reset_url)}</code>
        </p>
        """,
    )
    return subject, html


def team_approved_email(team_name: str, login_url: str) -> tuple[str, str]:
    subject = f"Your Team '{team_name}' Has Been Approved"
    html = _base_template(
        "Team Registration Approved",
        f"""
        <h2>Congratulations! 🎉</h2>
        <p>Your team <strong>{escape(team_name)}</strong> has been approved on the Synopsis Review Portal.</p>
        <p>You can now log in and start submitting your project synopsis documents.</p>
        <a href="{escape(login_url, quote=True)}" class="btn">Go to Portal</a>
        <p>If you have any questions, contact your department administrator.</p>
        """,
    )
    return subject, html


def reviewer_approved_email(reviewer_name: str, login_url: str) -> tuple[str, str]:
    subject = "Your Reviewer Account Has Been Approved"
    html = _base_template(
        "Reviewer Account Approved",
        f"""
        <h2>Welcome aboard, {escape(reviewer_name)}!</h2>
        <p>Your reviewer account on the Synopsis Review Portal has been approved.</p>
        <p>You can now log in to view your assigned teams and submit review scores.</p>
        <a href="{escape(login_url, quote=True)}" class="btn">Log In Now</a>
        """,
    )
    return subject, html


def scores_released_email(team_name: str, portal_url: str) -> tuple[str, str]:
    subject = "Your Review Scores Are Now Available"
    results_url = f"{portal_url.rstrip('/')}/student/results"
    html = _base_template(
        "Scores Released",
        f"""
        <h2>Your scores are ready!</h2>
        <p>The review scores for team <strong>{escape(team_name)}</strong> have been published.</p>
        <p>Log in to the portal to view your detailed scores, reviewer feedback,
           and similarity report.</p>
        <a href="{escape(results_url, quote=True)}" class="btn">View My Scores</a>
        """,
    )
    return subject, html


def generic_announcement_email(
    subject_line: str,
    body_text: str,
    action_url: Optional[str] = None,
) -> tuple[str, str]:
    safe_body = escape(body_text).replace("\n", "<br/>")
    content = f"<p>{safe_body}</p>"
    if action_url:
        safe_action_url = escape(action_url, quote=True)
        content += f"""
        <p><a href="{safe_action_url}" class="btn">Open Portal</a></p>
        <p style="font-size:13px;color:#6b7280;">
          Or copy this link into your browser:<br/>
          <code style="word-break:break-all;">{safe_action_url}</code>
        </p>
        """
    html = _base_template(
        "Announcement",
        content,
    )
    return subject_line, html