"""
Email Pre-filtering Service for Task Extraction

Implements a 3-stage pipeline:
- Stage 1: Rule-based pre-filtering (blacklist domains, keywords)
- Stage 2: Fast classification (action verbs, request patterns)
- Stage 3: LLM extraction (only for high-potential emails)

This reduces LLM calls by 60-80% while maintaining extraction accuracy.
"""
import re
from typing import List, Dict, Tuple
from dataclasses import dataclass
from enum import Enum


class EmailCategory(Enum):
    """Email classification categories"""
    ACTIONABLE = "actionable"      # High priority - likely contains tasks
    MAYBE_ACTIONABLE = "maybe"     # Medium priority - might contain tasks
    SKIP = "skip"                  # Low priority - likely no tasks (newsletter, promo)


@dataclass
class FilterResult:
    """Result of email filtering"""
    email_id: str
    category: EmailCategory
    score: float  # 0.0 to 1.0 actionability score
    skip_reason: str = None


# ==================== Stage 1: Blacklist/Whitelist Rules ====================

# Domains that typically send newsletters/promotions (no tasks)
BLACKLIST_DOMAINS = {
    # Marketing/Newsletter platforms
    'mailchimp.com', 'mailchi.mp', 'sendgrid.net', 'constantcontact.com',
    'hubspot.com', 'hubspotmail.com', 'marketo.com', 'mailgun.org',
    'campaign-archive.com', 'list-manage.com',

    # E-commerce/Retail
    'amazon.com', 'ebay.com', 'aliexpress.com', 'wish.com',
    'shopify.com', 'etsy.com', 'walmart.com', 'target.com',

    # Social media notifications
    'facebookmail.com', 'linkedin.com', 'twitter.com', 'x.com',
    'instagram.com', 'tiktok.com', 'pinterest.com',

    # Newsletters/Content
    'substack.com', 'medium.com', 'beehiiv.com', 'revue.co',
    'getrevue.co', 'buttondown.email', 'convertkit.com',

    # Financial notifications (usually receipts, not tasks)
    'venmo.com', 'paypal.com', 'stripe.com', 'square.com',

    # Travel/Booking confirmations
    'booking.com', 'expedia.com', 'airbnb.com', 'hotels.com',

}

# Sender patterns that indicate newsletters/automated emails
BLACKLIST_SENDER_PATTERNS = [
    r'newsletter', r'\bnews@', r'\bmarketing@', r'\bpromo@', r'\bpromotions@',
    r'noreply', r'no-reply', r'donotreply', r'do-not-reply',
    r'\bnotifications?@', r'\balerts?@', r'\bupdates?@', r'\binfo@',
    r'\bsupport@', r'\bhelp@', r'\bteam@', r'\bhello@', r'\bhi@',
    r'\bdigest@', r'\bweekly@', r'\bdaily@', r'\bmonthly@',
    r'automated', r'mailer-daemon', r'postmaster',

    # Calendar notification senders (events already captured via Calendar API)
    r'calendar-notification@google\.com',
    r'calendar-server-noreply@google\.com',
]

# Subject patterns that indicate newsletters/non-actionable
BLACKLIST_SUBJECT_PATTERNS = [
    r'newsletter', r'digest', r'weekly\s+(?:update|roundup|summary)',
    r'your\s+(?:receipt|order|confirmation|subscription)',
    r'unsubscribe', r'verify\s+your\s+email', r'confirm\s+your\s+email',
    r'password\s+reset', r'security\s+alert', r'sign[- ]?in\s+notification',
    r'(?:new|daily|weekly|monthly)\s+(?:deals?|offers?|savings?|discount)',
    r'%\s+off', r'\$\d+\s+off', r'limited\s+time', r'flash\s+sale',
    r'shipped|delivered|out\s+for\s+delivery',
    r'(?:package|order|shipment)\s+tracking', r'tracking\s+(?:number|info|update|id)',

    # Calendar invitation emails (already captured via Calendar API — avoid duplicates)
    r'^(?:invitation|updated\s+invitation|cancell?ed\s+event|cancell?ed\s*:)',
    r'^(?:accepted|declined|tentative|maybe)\s*:',
    r'^(?:rsvp|you\'?ve?\s+been\s+invited)',
]


# ==================== Stage 2: Actionability Indicators ====================

# Action verbs/phrases that indicate a task/request
# Two groups:
# 1. STEM patterns: use word-start boundary + stem prefix (matches all inflections)
#    e.g., 'review' matches review/reviewed/reviewing/reviewer
# 2. EXACT phrases: use full word boundaries (multi-word or must be exact)
_ACTION_STEM_STRINGS = [
    # Verbs that should match all inflected forms (review→reviewed/reviewing/etc.)
    'review', 'approv', 'submit', 'complet', 'finish',
    'provid', 'confirm', 'respond', 'schedul', 'arrang',
    'prepar', 'organiz', 'await', 'remind', 'expir',
    'reschedul', 'reassign', 'escalat', 'updat', 'renew', 'request',
]
_ACTION_EXACT_STRINGS = [
    # Multi-word phrases and keywords that need exact matching
    'please', 'could you', 'can you', 'would you', 'need you to',
    'sign off', 'sign-off', 'send', 'share', 'plan',
    'follow up', 'follow-up', 'followup', 'get back to',
    'let me know', 'let us know', 'waiting for',
    'asap', 'urgent', 'important', 'deadline', 'due by', 'due date',
    'by end of', 'by eod', 'by cob', 'by tomorrow', 'by monday',
    'action required', 'action needed', 'action item',
    'todo', 'to-do', 'to do', 'task',
    "don't forget", 'remember to', 'make sure',
    'needs your', 'need your', 'requires your',
]
# Stem patterns: \bstem\w* — matches word-start + any suffix
ACTION_VERB_PATTERNS = [re.compile(r'\b' + re.escape(s) + r'\w*', re.IGNORECASE) for s in _ACTION_STEM_STRINGS]
# Exact patterns: \bphrase\b — full word boundary
ACTION_VERB_PATTERNS += [re.compile(r'\b' + re.escape(v) + r'\b', re.IGNORECASE) for v in _ACTION_EXACT_STRINGS]

# Request patterns that indicate actionable content (pre-compiled for performance)
REQUEST_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'(?:please|could you|can you|would you)\s+\w+',
    r'(?:need|want|require)\s+(?:you|your)\s+(?:to|input|feedback)',
    r'(?:by|before|until)\s+(?:tomorrow|monday|tuesday|wednesday|thursday|friday|eod|cob)',
    r'deadline\s*:?\s*\w+',
    r'due\s*(?:by|date|on)\s*:?\s*\w+',
    r'\?(?:\s|$)',  # Questions (? followed by space or end of text)
    r'(?:urgent|asap|important|priority)',
    r'waiting\s+(?:for|on)\s+(?:you|your)',
    r'(?:follow|circle)\s*-?\s*up',
    r'(?:expir|renew)\w*\s+(?:on|by|in|before|soon)',  # "expires on March 1st", "renewal by..."
    r'(?:needs?|requires?)\s+(?:attention|action|response|input|approval|sign)',
]]


def _extract_domain(email) -> str:
    """Extract domain from email address (handles string or dict format)"""
    # Handle dict format from Gmail API: {'name': 'John', 'email': 'john@work.com'}
    if isinstance(email, dict):
        email = email.get('email', '') or email.get('address', '')

    if not email or not isinstance(email, str) or '@' not in email:
        return ''
    return email.split('@')[-1].lower().strip('>')


def _check_blacklist_domain(email_from: str) -> Tuple[bool, str]:
    """Check if sender domain is blacklisted"""
    domain = _extract_domain(email_from)
    if not domain:
        return False, None

    for blacklist in BLACKLIST_DOMAINS:
        # Exact match or subdomain match (e.g., mail.amazon.com matches amazon.com)
        # Avoid false positives like myamazon.com matching amazon.com
        if domain == blacklist or domain.endswith('.' + blacklist):
            return True, f"Blacklisted domain: {blacklist}"

    return False, None


def _check_blacklist_patterns(email_from: str, subject: str) -> Tuple[bool, str]:
    """Check if sender or subject matches blacklist patterns"""
    email_from_lower = email_from.lower()
    subject_lower = subject.lower()

    # Check sender patterns
    for pattern in BLACKLIST_SENDER_PATTERNS:
        if re.search(pattern, email_from_lower):
            return True, f"Blacklisted sender pattern: {pattern}"

    # Check subject patterns
    for pattern in BLACKLIST_SUBJECT_PATTERNS:
        if re.search(pattern, subject_lower, re.IGNORECASE):
            return True, f"Blacklisted subject pattern: {pattern}"

    return False, None


def _calculate_actionability_score(email: Dict) -> float:
    """
    Calculate actionability score (0.0 to 1.0) based on content analysis.
    Higher score = more likely to contain actionable tasks.
    Uses body_text (full body) when available, falls back to snippet.
    """
    score = 0.0
    # Prefer full body (from 2nd-pass fetch) over snippet for much better accuracy
    content = email.get('body_text') or email.get('snippet', '')
    text = f"{email.get('subject', '')} {content[:800]}".lower()

    # Check for action verbs (+0.15 each, max 0.6)
    action_count = 0
    for pattern in ACTION_VERB_PATTERNS:
        if pattern.search(text):
            action_count += 1
            if action_count >= 4:
                break
    score += min(0.6, action_count * 0.15)

    # Check for request patterns (+0.2 each, max 0.4)
    pattern_count = 0
    for pattern in REQUEST_PATTERNS:
        if pattern.search(text):
            pattern_count += 1
            if pattern_count >= 2:
                break
    score += min(0.4, pattern_count * 0.2)

    # Bonus for starred/important emails (+0.2)
    if email.get('labelIds'):
        labels = email.get('labelIds', [])
        if 'STARRED' in labels or 'IMPORTANT' in labels:
            score += 0.2

    # Penalty for very short snippets (likely auto-generated)
    snippet = email.get('snippet', '')
    if len(snippet) < 30:
        score -= 0.1

    return max(0.0, min(1.0, score))


def filter_emails_stage1(emails: List[Dict]) -> Tuple[List[Dict], List[FilterResult]]:
    """
    Stage 1: Rule-based pre-filtering.
    Removes obvious newsletters, promotions, and automated emails.

    Returns:
        - Tuple of (emails_to_process, filter_results)
    """
    to_process = []
    results = []

    for email in emails:
        email_id = email.get('id', '')
        email_from = str(email.get('from', ''))
        if isinstance(email.get('from'), dict):
            email_from = email['from'].get('email', '') or email['from'].get('name', '')
        subject = email.get('subject', '')

        # Check blacklist domain
        is_blacklisted, reason = _check_blacklist_domain(email_from)
        if is_blacklisted:
            results.append(FilterResult(
                email_id=email_id,
                category=EmailCategory.SKIP,
                score=0.0,
                skip_reason=reason
            ))
            continue

        # Check blacklist patterns
        is_blacklisted, reason = _check_blacklist_patterns(email_from, subject)
        if is_blacklisted:
            results.append(FilterResult(
                email_id=email_id,
                category=EmailCategory.SKIP,
                score=0.0,
                skip_reason=reason
            ))
            continue

        # Email passed Stage 1
        to_process.append(email)

    return to_process, results


def filter_emails_stage2(emails: List[Dict],
                          actionable_threshold: float = 0.3,
                          maybe_threshold: float = 0.15) -> Tuple[List[Dict], List[Dict], List[FilterResult]]:
    """
    Stage 2: Fast classification.
    Scores emails by actionability and categorizes them.

    Args:
        emails: Emails that passed Stage 1
        actionable_threshold: Score threshold for "actionable" category
        maybe_threshold: Score threshold for "maybe actionable" category

    Returns:
        - Tuple of (high_priority_emails, medium_priority_emails, filter_results)
    """
    high_priority = []
    medium_priority = []
    results = []

    for email in emails:
        email_id = email.get('id', '')
        score = _calculate_actionability_score(email)

        if score >= actionable_threshold:
            high_priority.append(email)
            results.append(FilterResult(
                email_id=email_id,
                category=EmailCategory.ACTIONABLE,
                score=score
            ))
        elif score >= maybe_threshold:
            medium_priority.append(email)
            results.append(FilterResult(
                email_id=email_id,
                category=EmailCategory.MAYBE_ACTIONABLE,
                score=score
            ))
        else:
            results.append(FilterResult(
                email_id=email_id,
                category=EmailCategory.SKIP,
                score=score,
                skip_reason="Low actionability score"
            ))

    return high_priority, medium_priority, results


def filter_emails_for_extraction(emails: List[Dict],
                                  include_medium_priority: bool = True,
                                  max_emails_for_llm: int = 15) -> Tuple[List[Dict], Dict]:
    """
    Main entry point: Run emails through the 2-stage filtering pipeline.

    Args:
        emails: Raw emails to filter
        include_medium_priority: Whether to include medium-priority emails
        max_emails_for_llm: Maximum emails to send to LLM

    Returns:
        - Tuple of (emails_for_llm, stats_dict)
    """
    stats = {
        "total_input": len(emails),
        "stage1_filtered": 0,
        "stage2_actionable": 0,
        "stage2_maybe": 0,
        "stage2_skipped": 0,
        "final_for_llm": 0,
    }

    if not emails:
        return [], stats

    # Stage 1: Rule-based filtering
    passed_stage1, stage1_results = filter_emails_stage1(emails)
    stats["stage1_filtered"] = len(emails) - len(passed_stage1)

    # Stage 2: Fast classification
    high_priority, medium_priority, stage2_results = filter_emails_stage2(passed_stage1)
    stats["stage2_actionable"] = len(high_priority)
    stats["stage2_maybe"] = len(medium_priority)
    stats["stage2_skipped"] = len(passed_stage1) - len(high_priority) - len(medium_priority)

    # Combine results based on settings
    final_emails = high_priority
    if include_medium_priority:
        final_emails = high_priority + medium_priority

    # Limit to max_emails_for_llm
    final_emails = final_emails[:max_emails_for_llm]
    stats["final_for_llm"] = len(final_emails)

    return final_emails, stats


# Utility function to add custom blacklist domains at runtime
def add_blacklist_domain(domain: str):
    """Add a domain to the blacklist"""
    BLACKLIST_DOMAINS.add(domain.lower())


def add_blacklist_sender_pattern(pattern: str):
    """Add a sender pattern to the blacklist"""
    BLACKLIST_SENDER_PATTERNS.append(pattern)
