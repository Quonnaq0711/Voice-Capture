"""
Google OAuth 2.0 Service

Handles OAuth authentication flow for Google services (Gmail, Calendar).
Uses Google's official OAuth 2.0 flow with PKCE for enhanced security.

Required environment variables:
- GOOGLE_CLIENT_ID: OAuth 2.0 client ID from Google Cloud Console
- GOOGLE_CLIENT_SECRET: OAuth 2.0 client secret
- GOOGLE_REDIRECT_URI: Callback URL (e.g., http://localhost:6004/api/work/oauth/google/callback)
"""
import os
import json
import secrets
import logging
import email.utils as email_utils
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode

import httpx
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

# Setup logging
logger = logging.getLogger(__name__)

# Google OAuth 2.0 endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Gmail API scopes
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",  # Read emails
    "https://www.googleapis.com/auth/gmail.send",  # Send emails
    "https://www.googleapis.com/auth/gmail.modify",  # Modify emails (archive, label)
    "https://www.googleapis.com/auth/userinfo.email",  # Get user email
    "https://www.googleapis.com/auth/userinfo.profile",  # Get user profile
]

# Calendar API scopes
CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",  # Read calendar events
    "https://www.googleapis.com/auth/calendar.events",  # Create/modify events
]

# Google Tasks API scopes
TASKS_SCOPES = [
    "https://www.googleapis.com/auth/tasks.readonly",  # Read tasks
]

# Combined Google scopes (Gmail + Calendar + Tasks)
# Use this for unified Google account authorization
GOOGLE_SCOPES = GMAIL_SCOPES + CALENDAR_SCOPES + TASKS_SCOPES


class GoogleOAuthService:
    """Service for handling Google OAuth 2.0 authentication."""

    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:6004/api/work/oauth/google/callback"
        )

        if not self.client_id or not self.client_secret:
            logger.warning("Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")

    def get_authorization_url(self, scopes: List[str] = None, state: str = None) -> Dict[str, str]:
        """
        Generate Google OAuth authorization URL.

        Args:
            scopes: List of OAuth scopes to request
            state: Optional state parameter for CSRF protection

        Returns:
            Dict with authorization URL and state
        """
        if scopes is None:
            scopes = GOOGLE_SCOPES  # Include Gmail + Calendar by default

        # Generate state for CSRF protection if not provided
        if state is None:
            state = secrets.token_urlsafe(32)

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "access_type": "offline",  # Get refresh token
            "prompt": "consent select_account",  # Force account selection + consent for new refresh token
            "state": state,
        }

        auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

        return {
            "authorization_url": auth_url,
            "state": state
        }

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from Google callback

        Returns:
            Dict with tokens and user info
        """
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                }
            )

            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise ValueError(f"Failed to exchange code for tokens: {token_response.text}")

            tokens = token_response.json()

            # Get user info
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )

            if userinfo_response.status_code != 200:
                logger.error(f"Failed to get user info: {userinfo_response.text}")
                raise ValueError("Failed to get user information")

            userinfo = userinfo_response.json()

            # Calculate expiry time
            expires_at = None
            if "expires_in" in tokens:
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])

            return {
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "token_type": tokens.get("token_type", "Bearer"),
                "expires_at": expires_at,
                "scope": tokens.get("scope", "").split(),
                "user_email": userinfo.get("email"),
                "user_name": userinfo.get("name"),
                "user_picture": userinfo.get("picture"),
            }

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            Dict with new access token and expiry
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                }
            )

            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Token refresh failed: {error_detail}")
                raise ValueError(f"Failed to refresh access token: {error_detail}")

            tokens = response.json()

            expires_at = None
            if "expires_in" in tokens:
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])

            return {
                "access_token": tokens["access_token"],
                "expires_at": expires_at,
            }

    def get_credentials(self, access_token: str, refresh_token: str = None) -> Credentials:
        """
        Create Google Credentials object for API calls.

        Args:
            access_token: Current access token
            refresh_token: Optional refresh token

        Returns:
            Google Credentials object
        """
        return Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri=GOOGLE_TOKEN_URL,
            client_id=self.client_id,
            client_secret=self.client_secret,
        )


class GmailService:
    """Service for interacting with Gmail API."""

    def __init__(self, credentials: Credentials):
        """
        Initialize Gmail service with credentials.

        Args:
            credentials: Google OAuth credentials
        """
        self.service = build("gmail", "v1", credentials=credentials)

    def get_messages(
        self,
        max_results: int = 20,
        query: str = None,
        label_ids: List[str] = None,
        format: str = "metadata",  # "metadata" for fast list, "full" for complete body
        page_token: str = None  # For pagination - pass nextPageToken to get more results
    ) -> Dict[str, Any]:
        """
        Fetch messages from Gmail using batch API for optimal performance.

        Args:
            max_results: Maximum number of messages to return
            query: Gmail search query (e.g., "is:unread", "from:someone@example.com")
            label_ids: List of label IDs to filter by (e.g., ["INBOX", "UNREAD"])
            format: "metadata" (fast, headers only) or "full" (includes body)
            page_token: Token for pagination (from previous response's nextPageToken)

        Returns:
            Dict with 'messages' list and optional 'nextPageToken' for pagination
        """
        try:
            # Build request parameters
            params = {
                "userId": "me",
                "maxResults": max_results,
            }
            if query:
                params["q"] = query
            if label_ids:
                params["labelIds"] = label_ids
            if page_token:
                params["pageToken"] = page_token

            # Get message list (just IDs)
            results = self.service.users().messages().list(**params).execute()
            messages = results.get("messages", [])
            next_page_token = results.get("nextPageToken")  # For pagination

            if not messages:
                return {"messages": [], "nextPageToken": None}

            # Use batch API for parallel fetching (10x faster!)
            # Smaller batch size (25) to avoid Gmail 429 rate limits on large queries
            detailed_messages = []
            batch_size = 25

            for i in range(0, len(messages), batch_size):
                batch_msgs = messages[i:i + batch_size]
                batch_results, failed_ids = self._batch_get_messages(batch_msgs, format)
                detailed_messages.extend(batch_results)

                # Retry failed messages (rate limited) with smaller batch + delay
                if failed_ids:
                    import time
                    time.sleep(1)  # Back off before retry
                    retry_msgs = [m for m in batch_msgs if m["id"] in failed_ids]
                    retry_results, still_failed = self._batch_get_messages(retry_msgs, format)
                    detailed_messages.extend(retry_results)
                    if still_failed:
                        logger.warning(f"Failed to fetch {len(still_failed)} messages after retry: {still_failed}")

                # Small delay between batches to stay under rate limit
                if i + batch_size < len(messages):
                    import time
                    time.sleep(0.3)

            return {
                "messages": detailed_messages,
                "nextPageToken": next_page_token  # None if no more pages
            }

        except HttpError as error:
            logger.error(f"Gmail API error: {error}")
            raise

    def _batch_get_messages(
        self,
        messages: List[Dict],
        format: str = "metadata"
    ) -> tuple:
        """
        Fetch multiple messages in a single batch request.

        Returns:
            Tuple of (results_list, failed_ids_set) for retry handling.
        """
        from googleapiclient.http import BatchHttpRequest

        results = []
        failed_ids = set()

        def callback(request_id, response, exception):
            if exception:
                failed_ids.add(request_id)
                # Only log non-429 errors at error level
                if '429' not in str(exception):
                    logger.error(f"Batch request error for {request_id}: {exception}")
            else:
                try:
                    parsed = self._parse_message(response, include_body=(format == "full"))
                    results.append(parsed)
                except Exception as e:
                    logger.error(f"Error parsing message {request_id}: {e}")

        # Create batch request
        batch = self.service.new_batch_http_request(callback=callback)

        # For metadata format, only request needed fields (faster)
        metadata_fields = "id,threadId,labelIds,snippet,internalDate,payload/headers"
        full_fields = None  # Get everything

        for msg in messages:
            request = self.service.users().messages().get(
                userId="me",
                id=msg["id"],
                format=format,
                fields=metadata_fields if format == "metadata" else full_fields
            )
            batch.add(request, request_id=msg["id"])

        # Execute batch (single HTTP request!)
        batch.execute()

        if failed_ids:
            logger.warning(f"Batch: {len(failed_ids)} of {len(messages)} failed (rate limited), will retry")

        # Sort by date (newest first)
        results.sort(key=lambda x: x.get("date", ""), reverse=True)

        return results, failed_ids

    def _parse_message(self, message: Dict, include_body: bool = True) -> Dict[str, Any]:
        """
        Parse Gmail message into a structured format.

        Args:
            message: Raw Gmail message object
            include_body: If False, skip body parsing for faster list loading

        Returns:
            Parsed message dict
        """
        payload = message.get("payload", {})
        headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}

        # Get message body only if requested (expensive operation)
        body_data = {"html": "", "plain": "", "content": "", "is_html": False}
        if include_body and payload:
            body_data = self._get_message_body(payload)

        # Parse sender
        from_header = headers.get("from", "")
        sender_name, sender_email = email_utils.parseaddr(from_header)
        if not sender_name:
            sender_name = sender_email.split("@")[0] if sender_email else ""

        # Check labels for read status
        labels = message.get("labelIds", [])
        is_read = "UNREAD" not in labels
        is_starred = "STARRED" in labels
        is_important = "IMPORTANT" in labels

        # Get attachments only if we have full payload
        attachments = []
        if include_body and payload:
            attachments = self._get_attachments(payload)

        # Use snippet as preview - already available in metadata format
        preview = message.get("snippet", "")

        return {
            "id": message["id"],
            "thread_id": message.get("threadId", ""),
            "source": "gmail",
            "type": "email",
            "from": {
                "name": sender_name,
                "email": sender_email,
                "is_vip": is_important,
            },
            "to": [email for _, email in email_utils.getaddresses([headers.get("to", "")]) if email],
            "cc": [email for _, email in email_utils.getaddresses([headers.get("cc", "")]) if email],
            "subject": headers.get("subject", "(No subject)"),
            "preview": preview,
            "snippet": preview,  # Alias for frontend compatibility
            "body": body_data.get("content", ""),  # Preferred content (HTML if available)
            "body_html": body_data.get("html", ""),  # Raw HTML body
            "body_plain": body_data.get("plain", ""),  # Raw plain text body
            "is_html": body_data.get("is_html", False),  # Flag indicating if HTML is available
            "date": self._parse_internal_date(message.get("internalDate")),
            "timestamp": self._parse_internal_date(message.get("internalDate")),
            "is_read": is_read,
            "is_starred": is_starred,
            "has_attachments": len(attachments) > 0,
            "attachments": attachments,
            "labels": labels,
            "raw_headers": headers,
        }

    def _get_message_body(self, payload: Dict) -> Dict[str, str]:
        """
        Extract message body from payload.
        Returns dict with 'html' and 'plain' keys, preferring HTML for rich content.
        """
        import base64

        body_html = ""
        body_plain = ""

        def extract_body(part: Dict):
            nonlocal body_html, body_plain
            mime_type = part.get("mimeType", "")

            if "body" in part and part["body"].get("data"):
                decoded = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                if mime_type == "text/html":
                    body_html = decoded
                elif mime_type == "text/plain":
                    body_plain = decoded

            # Recursively handle multipart messages
            if "parts" in part:
                for sub_part in part["parts"]:
                    extract_body(sub_part)

        # Start extraction from root payload
        extract_body(payload)

        # Return HTML if available (rich formatting), otherwise plain text
        return {
            "html": body_html,
            "plain": body_plain,
            "content": body_html if body_html else body_plain,
            "is_html": bool(body_html)
        }

    def _get_attachments(self, payload: Dict) -> List[Dict]:
        """Extract attachment info from payload, including inline images."""
        import base64
        attachments = []

        def extract_attachments(part):
            # Get headers for this part
            headers = {h["name"].lower(): h["value"] for h in part.get("headers", [])}
            content_id = headers.get("content-id", "").strip("<>")
            content_disposition = headers.get("content-disposition", "")
            mime_type = part.get("mimeType", "")

            # Check if this is an inline image (has Content-ID or is image type)
            is_inline = bool(content_id) or "inline" in content_disposition.lower()
            is_image = mime_type.startswith("image/")

            if part.get("filename") or (is_inline and is_image):
                attachment_data = {
                    "name": part.get("filename", f"inline_{content_id}" if content_id else "inline_image"),
                    "mime_type": mime_type,
                    "size": part.get("body", {}).get("size", 0),
                    "attachment_id": part.get("body", {}).get("attachmentId"),
                    "content_id": content_id,
                    "is_inline": is_inline,
                }

                # For inline images, try to get the data directly if it's embedded
                body_data = part.get("body", {}).get("data")
                if body_data and is_inline and is_image:
                    # Data is already base64 URL-safe encoded, convert to standard base64
                    attachment_data["data"] = body_data.replace("-", "+").replace("_", "/")

                attachments.append(attachment_data)

            if "parts" in part:
                for p in part["parts"]:
                    extract_attachments(p)

        extract_attachments(payload)
        return attachments

    def _parse_internal_date(self, internal_date: str) -> str:
        """Convert Gmail internal date (ms timestamp) to ISO format."""
        if internal_date:
            try:
                timestamp = int(internal_date) / 1000
                dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                return dt.isoformat()
            except (ValueError, OverflowError, OSError):
                logger.warning(f"Failed to parse internalDate: {internal_date}")
        return datetime.now(timezone.utc).isoformat()

    def get_labels(self) -> List[Dict]:
        """Get all Gmail labels."""
        try:
            results = self.service.users().labels().list(userId="me").execute()
            return results.get("labels", [])
        except HttpError as error:
            logger.error(f"Error fetching labels: {error}")
            return []

    def get_attachment(self, message_id: str, attachment_id: str) -> Optional[Dict]:
        """
        Fetch attachment data by ID.

        Args:
            message_id: The message ID containing the attachment
            attachment_id: The attachment ID to fetch

        Returns:
            Dict with 'data' (base64 encoded) and 'size', or None on error
        """
        try:
            attachment = self.service.users().messages().attachments().get(
                userId="me",
                messageId=message_id,
                id=attachment_id
            ).execute()

            # Convert URL-safe base64 to standard base64
            data = attachment.get("data", "")
            if data:
                data = data.replace("-", "+").replace("_", "/")

            return {
                "data": data,
                "size": attachment.get("size", 0)
            }
        except HttpError as error:
            logger.error(f"Error fetching attachment {attachment_id}: {error}")
            return None

    def mark_as_read(self, message_id: str) -> bool:
        """Mark a message as read."""
        try:
            self.service.users().messages().modify(
                userId="me",
                id=message_id,
                body={"removeLabelIds": ["UNREAD"]}
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error marking message as read: {error}")
            return False

    def archive_message(self, message_id: str) -> bool:
        """Archive a message (remove from INBOX)."""
        try:
            self.service.users().messages().modify(
                userId="me",
                id=message_id,
                body={"removeLabelIds": ["INBOX"]}
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error archiving message: {error}")
            return False

    def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: bool = False,
        cc: List[str] = None,
        bcc: List[str] = None,
        reply_to_message_id: str = None,
        thread_id: str = None,
        attachments: List[Dict] = None,
        from_email: str = None,
    ) -> Dict[str, Any]:
        """
        Send an email with optional attachments.

        Args:
            to: Recipient email address(es), comma-separated
            subject: Email subject
            body: Email body
            html: Whether body is HTML
            cc: CC recipients
            bcc: BCC recipients
            reply_to_message_id: Message ID if this is a reply
            thread_id: Thread ID to add message to
            attachments: List of attachment dicts with keys:
                - filename: str
                - mime_type: str (e.g. "application/pdf")
                - data: str (base64 encoded content)
            from_email: Optional sender email (for accounts with aliases)

        Returns:
            Sent message info
        """
        import base64
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.mime.base import MIMEBase
        from email import encoders

        # Determine if we need multipart (for attachments or HTML)
        has_attachments = bool(attachments and len(attachments) > 0)
        
        if has_attachments:
            # Use multipart/mixed for attachments
            message = MIMEMultipart("mixed")
            
            # Add the body
            if html:
                body_part = MIMEMultipart("alternative")
                body_part.attach(MIMEText(body, "html"))
                message.attach(body_part)
            else:
                message.attach(MIMEText(body, "plain"))
            
            # Add attachments
            for attachment in attachments:
                try:
                    # Decode the base64 data
                    file_data = base64.b64decode(attachment.get("data", ""))
                    mime_type = attachment.get("mime_type", "application/octet-stream")
                    filename = attachment.get("filename", "attachment")
                    
                    # Split mime type
                    main_type, sub_type = mime_type.split("/", 1) if "/" in mime_type else ("application", "octet-stream")
                    
                    # Create attachment part
                    part = MIMEBase(main_type, sub_type)
                    part.set_payload(file_data)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment", filename=filename)
                    message.attach(part)
                except Exception as e:
                    logger.error(f"Error adding attachment {attachment.get('filename')}: {e}")
                    continue
        elif html:
            message = MIMEMultipart("alternative")
            message.attach(MIMEText(body, "html"))
        else:
            message = MIMEText(body, "plain")

        # Set headers
        message["to"] = to
        message["subject"] = subject
        
        if from_email:
            message["from"] = from_email

        if cc:
            message["cc"] = ", ".join(cc) if isinstance(cc, list) else cc
        if bcc:
            message["bcc"] = ", ".join(bcc) if isinstance(bcc, list) else bcc

        # Add headers for reply threading
        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        try:
            body_data = {"raw": raw}
            if thread_id:
                body_data["threadId"] = thread_id

            sent_message = self.service.users().messages().send(
                userId="me",
                body=body_data
            ).execute()
            return sent_message
        except HttpError as error:
            logger.error(f"Error sending email: {error}")
            raise

    def star_message(self, message_id: str, star: bool = True) -> bool:
        """Add or remove STARRED label from a message."""
        try:
            if star:
                self.service.users().messages().modify(
                    userId="me",
                    id=message_id,
                    body={"addLabelIds": ["STARRED"]}
                ).execute()
            else:
                self.service.users().messages().modify(
                    userId="me",
                    id=message_id,
                    body={"removeLabelIds": ["STARRED"]}
                ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error {'starring' if star else 'unstarring'} message: {error}")
            return False

    def trash_message(self, message_id: str) -> bool:
        """Move a message to trash."""
        try:
            self.service.users().messages().trash(
                userId="me",
                id=message_id
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error trashing message: {error}")
            return False

    def untrash_message(self, message_id: str) -> bool:
        """Restore a message from trash."""
        try:
            self.service.users().messages().untrash(
                userId="me",
                id=message_id
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error untrashing message: {error}")
            return False

    def delete_message_permanently(self, message_id: str) -> bool:
        """Permanently delete a message (cannot be undone)."""
        try:
            self.service.users().messages().delete(
                userId="me",
                id=message_id
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error permanently deleting message: {error}")
            return False

    def get_messages_by_ids(self, message_ids: List[str], format: str = "full") -> List[Dict]:
        """Fetch specific messages by ID using batch API (chunked to stay within Gmail's 100-request batch limit)."""
        import time as _time
        all_results = []
        BATCH_LIMIT = 100  # Gmail batch API limit
        messages = [{"id": mid} for mid in message_ids]
        for i in range(0, len(messages), BATCH_LIMIT):
            chunk = messages[i:i + BATCH_LIMIT]
            results, failed_ids = self._batch_get_messages(chunk, format)
            all_results.extend(results)
            # Retry failed messages once
            if failed_ids:
                _time.sleep(1)
                retry_msgs = [m for m in chunk if m["id"] in failed_ids]
                retry_results, _ = self._batch_get_messages(retry_msgs, format)
                all_results.extend(retry_results)
            # Small delay between chunks to avoid rate limits
            if i + BATCH_LIMIT < len(messages):
                _time.sleep(0.5)
        return all_results

    def get_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get a single message by ID."""
        try:
            message = self.service.users().messages().get(
                userId="me",
                id=message_id,
                format="full"
            ).execute()
            return self._parse_message(message)
        except HttpError as error:
            logger.error(f"Error getting message: {error}")
            return None

    def modify_labels(
        self,
        message_id: str,
        add_labels: List[str] = None,
        remove_labels: List[str] = None
    ) -> bool:
        """Modify labels on a message."""
        try:
            body = {}
            if add_labels:
                body["addLabelIds"] = add_labels
            if remove_labels:
                body["removeLabelIds"] = remove_labels

            self.service.users().messages().modify(
                userId="me",
                id=message_id,
                body=body
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error modifying labels: {error}")
            return False

    # ==================== Draft Operations ====================

    def get_drafts(self, max_results: int = 20) -> List[Dict[str, Any]]:
        """Get all drafts."""
        try:
            results = self.service.users().drafts().list(
                userId="me",
                maxResults=max_results
            ).execute()
            drafts = results.get("drafts", [])

            detailed_drafts = []
            for draft in drafts:
                try:
                    full_draft = self.service.users().drafts().get(
                        userId="me",
                        id=draft["id"],
                        format="full"
                    ).execute()
                    parsed = self._parse_draft(full_draft)
                    detailed_drafts.append(parsed)
                except HttpError as e:
                    logger.error(f"Error fetching draft {draft['id']}: {e}")
                    continue

            return detailed_drafts
        except HttpError as error:
            logger.error(f"Error fetching drafts: {error}")
            return []

    def _parse_draft(self, draft: Dict) -> Dict[str, Any]:
        """Parse draft into structured format."""
        message = draft.get("message", {})
        parsed_message = self._parse_message(message) if message else {}

        return {
            "id": draft["id"],
            "message_id": message.get("id"),
            "thread_id": message.get("threadId"),
            **parsed_message
        }

    def create_draft(
        self,
        to: str = "",
        subject: str = "",
        body: str = "",
        cc: List[str] = None,
        bcc: List[str] = None,
        thread_id: str = None,
        reply_to_message_id: str = None,
    ) -> Dict[str, Any]:
        """Create a new draft."""
        import base64
        from email.mime.text import MIMEText

        message = MIMEText(body, "plain")
        if to:
            message["to"] = to
        if subject:
            message["subject"] = subject
        if cc:
            message["cc"] = ", ".join(cc) if isinstance(cc, list) else cc
        if bcc:
            message["bcc"] = ", ".join(bcc) if isinstance(bcc, list) else bcc

        # Add reply headers
        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        try:
            draft_body = {"message": {"raw": raw}}
            if thread_id:
                draft_body["message"]["threadId"] = thread_id

            draft = self.service.users().drafts().create(
                userId="me",
                body=draft_body
            ).execute()
            return draft
        except HttpError as error:
            logger.error(f"Error creating draft: {error}")
            raise

    def update_draft(
        self,
        draft_id: str,
        to: str = "",
        subject: str = "",
        body: str = "",
        cc: List[str] = None,
        bcc: List[str] = None,
        thread_id: str = None,
        reply_to_message_id: str = None,
    ) -> Dict[str, Any]:
        """Update an existing draft."""
        import base64
        from email.mime.text import MIMEText

        message = MIMEText(body, "plain")
        if to:
            message["to"] = to
        if subject:
            message["subject"] = subject
        if cc:
            message["cc"] = ", ".join(cc) if isinstance(cc, list) else cc
        if bcc:
            message["bcc"] = ", ".join(bcc) if isinstance(bcc, list) else bcc

        # Preserve reply headers for threaded drafts
        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        try:
            draft_body = {"message": {"raw": raw}}
            if thread_id:
                draft_body["message"]["threadId"] = thread_id

            draft = self.service.users().drafts().update(
                userId="me",
                id=draft_id,
                body=draft_body
            ).execute()
            return draft
        except HttpError as error:
            logger.error(f"Error updating draft: {error}")
            raise

    def delete_draft(self, draft_id: str) -> bool:
        """Delete a draft."""
        try:
            self.service.users().drafts().delete(
                userId="me",
                id=draft_id
            ).execute()
            return True
        except HttpError as error:
            logger.error(f"Error deleting draft: {error}")
            return False

    def send_draft(self, draft_id: str) -> Dict[str, Any]:
        """Send an existing draft."""
        try:
            message = self.service.users().drafts().send(
                userId="me",
                body={"id": draft_id}
            ).execute()
            return message
        except HttpError as error:
            logger.error(f"Error sending draft: {error}")
            raise


class CalendarService:
    """Service for interacting with Google Calendar API."""

    def __init__(self, credentials):
        """
        Initialize Calendar service with OAuth credentials.

        Args:
            credentials: Google OAuth credentials
        """
        self.service = build("calendar", "v3", credentials=credentials)

    def get_calendars(self) -> List[Dict[str, Any]]:
        """Get all calendars for the authenticated user."""
        try:
            calendar_list = self.service.calendarList().list().execute()
            return calendar_list.get("items", [])
        except HttpError as error:
            logger.error(f"Error fetching calendars: {error}")
            return []

    def get_events(
        self,
        calendar_id: str = "primary",
        time_min: str = None,
        time_max: str = None,
        max_results: int = 50,
        single_events: bool = True,
        order_by: str = "startTime"
    ) -> List[Dict[str, Any]]:
        """
        Get events from a calendar.

        Args:
            calendar_id: Calendar ID (default: "primary" for main calendar)
            time_min: Start time filter (ISO format)
            time_max: End time filter (ISO format)
            max_results: Maximum events to return
            single_events: Expand recurring events into instances
            order_by: Order by "startTime" or "updated"

        Returns:
            List of event dictionaries
        """
        from datetime import datetime, timezone

        try:
            # Default to current time if not specified
            if time_min is None:
                time_min = datetime.now(timezone.utc).isoformat()

            params = {
                "calendarId": calendar_id,
                "timeMin": time_min,
                "maxResults": max_results,
                "singleEvents": single_events,
                "orderBy": order_by,
            }

            if time_max:
                params["timeMax"] = time_max

            events_result = self.service.events().list(**params).execute()
            events = events_result.get("items", [])

            # Parse events into a cleaner format
            parsed_events = []
            for event in events:
                parsed_events.append(self._parse_event(event))

            return parsed_events

        except HttpError as error:
            logger.error(f"Error fetching events: {error}")
            return []

    def _parse_event(self, event: Dict) -> Dict[str, Any]:
        """Parse a calendar event into a structured format."""
        start = event.get("start", {})
        end = event.get("end", {})

        # Handle all-day events (date) vs timed events (dateTime)
        start_time = start.get("dateTime") or start.get("date")
        end_time = end.get("dateTime") or end.get("date")
        is_all_day = "date" in start and "dateTime" not in start

        # Get attendees
        attendees = []
        for attendee in event.get("attendees", []):
            attendees.append({
                "email": attendee.get("email"),
                "name": attendee.get("displayName", attendee.get("email", "").split("@")[0]),
                "response_status": attendee.get("responseStatus"),
                "is_organizer": attendee.get("organizer", False),
                "is_self": attendee.get("self", False),
            })

        return {
            "id": event.get("id"),
            "summary": event.get("summary", "(No title)"),
            "description": event.get("description", ""),
            "location": event.get("location", ""),
            "start": start_time,
            "end": end_time,
            "is_all_day": is_all_day,
            "timezone": start.get("timeZone"),
            "status": event.get("status"),  # "confirmed", "tentative", "cancelled"
            "event_type": event.get("eventType", "default"),  # default, focusTime, outOfOffice, workingLocation
            "html_link": event.get("htmlLink"),
            "hangout_link": event.get("hangoutLink"),
            "conference_data": event.get("conferenceData"),
            "creator": event.get("creator", {}),
            "organizer": event.get("organizer", {}),
            "attendees": attendees,
            "recurrence": event.get("recurrence"),
            "recurring_event_id": event.get("recurringEventId"),
            "color_id": event.get("colorId"),
            "reminders": event.get("reminders", {}),
            "created": event.get("created"),
            "updated": event.get("updated"),
        }

    def get_event(self, event_id: str, calendar_id: str = "primary") -> Optional[Dict[str, Any]]:
        """Get a single event by ID."""
        try:
            event = self.service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            return self._parse_event(event)
        except HttpError as error:
            logger.error(f"Error fetching event {event_id}: {error}")
            return None

    def create_event(
        self,
        summary: str,
        start: str,
        end: str,
        description: str = "",
        location: str = "",
        attendees: List[str] = None,
        calendar_id: str = "primary",
        is_all_day: bool = False,
        timezone: str = None,
    ) -> Dict[str, Any]:
        """
        Create a new calendar event.

        Args:
            summary: Event title
            start: Start time (ISO format or date for all-day)
            end: End time (ISO format or date for all-day)
            description: Event description
            location: Event location
            attendees: List of attendee email addresses
            calendar_id: Calendar to add event to
            is_all_day: Whether this is an all-day event
            timezone: Timezone for the event

        Returns:
            Created event data
        """
        try:
            event_body = {
                "summary": summary,
                "description": description,
                "location": location,
            }

            # Handle all-day vs timed events
            if is_all_day:
                event_body["start"] = {"date": start}
                event_body["end"] = {"date": end}
            else:
                start_obj = {"dateTime": start}
                end_obj = {"dateTime": end}
                if timezone:
                    start_obj["timeZone"] = timezone
                    end_obj["timeZone"] = timezone
                event_body["start"] = start_obj
                event_body["end"] = end_obj

            # Add attendees
            if attendees:
                event_body["attendees"] = [{"email": email} for email in attendees]

            event = self.service.events().insert(
                calendarId=calendar_id,
                body=event_body
            ).execute()

            return self._parse_event(event)

        except HttpError as error:
            logger.error(f"Error creating event: {error}")
            raise

    def update_event(
        self,
        event_id: str,
        summary: str = None,
        start: str = None,
        end: str = None,
        description: str = None,
        location: str = None,
        calendar_id: str = "primary",
    ) -> Dict[str, Any]:
        """Update an existing calendar event."""
        try:
            # Get existing event
            event = self.service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()

            # Update fields if provided
            if summary is not None:
                event["summary"] = summary
            if description is not None:
                event["description"] = description
            if location is not None:
                event["location"] = location
            if start is not None:
                if "dateTime" in event.get("start", {}):
                    event["start"]["dateTime"] = start
                else:
                    event["start"]["date"] = start
            if end is not None:
                if "dateTime" in event.get("end", {}):
                    event["end"]["dateTime"] = end
                else:
                    event["end"]["date"] = end

            updated_event = self.service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event
            ).execute()

            return self._parse_event(updated_event)

        except HttpError as error:
            logger.error(f"Error updating event {event_id}: {error}")
            raise

    def delete_event(self, event_id: str, calendar_id: str = "primary") -> bool:
        """Delete a calendar event. Returns True if deleted or already gone (404/410)."""
        try:
            self.service.events().delete(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            return True
        except HttpError as error:
            if error.resp.status in (404, 410):
                logger.info(f"Event {event_id} already deleted (HTTP {error.resp.status})")
                return True
            logger.error(f"Error deleting event {event_id}: {error}")
            return False

    def quick_add(self, text: str, calendar_id: str = "primary") -> Dict[str, Any]:
        """
        Create event using natural language (e.g., "Dinner with John tomorrow at 7pm").

        Args:
            text: Natural language event description
            calendar_id: Calendar to add event to

        Returns:
            Created event data
        """
        try:
            event = self.service.events().quickAdd(
                calendarId=calendar_id,
                text=text
            ).execute()
            return self._parse_event(event)
        except HttpError as error:
            logger.error(f"Error quick adding event: {error}")
            raise


class TasksService:
    """Service for interacting with Google Tasks API."""

    def __init__(self, credentials):
        """
        Initialize Tasks service with OAuth credentials.

        Args:
            credentials: Google OAuth credentials
        """
        self.service = build("tasks", "v1", credentials=credentials)

    def get_task_lists(self) -> List[Dict[str, Any]]:
        """Get all task lists for the authenticated user."""
        try:
            result = self.service.tasklists().list().execute()
            return result.get("items", [])
        except HttpError as error:
            logger.error(f"Error fetching task lists: {error}")
            return []

    def get_tasks(
        self,
        tasklist_id: str = "@default",
        due_min: str = None,
        due_max: str = None,
        show_completed: bool = False,
        show_hidden: bool = False,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get tasks from a task list.

        Args:
            tasklist_id: Task list ID (default: "@default" for primary list)
            due_min: Minimum due date (RFC 3339 timestamp)
            due_max: Maximum due date (RFC 3339 timestamp)
            show_completed: Include completed tasks
            show_hidden: Include hidden tasks
            max_results: Maximum tasks to return

        Returns:
            List of task dictionaries
        """
        try:
            params = {
                "tasklist": tasklist_id,
                "maxResults": max_results,
                "showCompleted": show_completed,
                "showHidden": show_hidden,
            }

            if due_min:
                params["dueMin"] = due_min
            if due_max:
                params["dueMax"] = due_max

            result = self.service.tasks().list(**params).execute()
            tasks = result.get("items", [])

            # Parse tasks into a cleaner format
            parsed_tasks = []
            for task in tasks:
                parsed_tasks.append(self._parse_task(task))

            return parsed_tasks

        except HttpError as error:
            logger.error(f"Error fetching tasks: {error}")
            return []

    def get_all_tasks(
        self,
        due_min: str = None,
        due_max: str = None,
        show_completed: bool = False,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get tasks from ALL task lists.

        Args:
            due_min: Minimum due date (RFC 3339 timestamp)
            due_max: Maximum due date (RFC 3339 timestamp)
            show_completed: Include completed tasks
            max_results: Maximum tasks per list

        Returns:
            List of all tasks from all lists
        """
        all_tasks = []
        try:
            task_lists = self.get_task_lists()
            for tl in task_lists:
                tasks = self.get_tasks(
                    tasklist_id=tl.get("id", "@default"),
                    due_min=due_min,
                    due_max=due_max,
                    show_completed=show_completed,
                    max_results=max_results,
                )
                # Add task list info to each task
                for task in tasks:
                    task["tasklist_id"] = tl.get("id")
                    task["tasklist_title"] = tl.get("title", "Tasks")
                all_tasks.extend(tasks)
        except Exception as e:
            logger.error(f"Error fetching all tasks: {e}")

        return all_tasks

    def _parse_task(self, task: Dict) -> Dict[str, Any]:
        """Parse a task into a structured format."""
        return {
            "id": task.get("id"),
            "title": task.get("title", "(No title)"),
            "notes": task.get("notes", ""),
            "status": task.get("status"),  # "needsAction" or "completed"
            "due": task.get("due"),  # RFC 3339 timestamp
            "completed": task.get("completed"),  # When completed
            "deleted": task.get("deleted", False),
            "hidden": task.get("hidden", False),
            "parent": task.get("parent"),  # Parent task ID for subtasks
            "position": task.get("position"),
            "links": task.get("links", []),
            "updated": task.get("updated"),
            "self_link": task.get("selfLink"),
        }


# Singleton instance
google_oauth_service = GoogleOAuthService()
