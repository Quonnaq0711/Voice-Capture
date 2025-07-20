import pytest
import json
from fastapi import status

class TestStreamingAPI:
    """Test suite for the streaming endpoints of the Personal Assistant API"""

    @pytest.mark.asyncio
    async def test_send_message_stream(self, async_client):
        """Test the successful streaming of a message response"""
        params = {"message": "Stream test", "session_id": "stream_session"}
        
        async with async_client.stream("GET", "/api/chat/message/stream", params=params) as response:
            assert response.status_code == status.HTTP_200_OK
            assert "text/event-stream" in response.headers["content-type"]

            # Read the full response at once to avoid timing issues
            full_response = await response.aread()
            lines = [line for line in full_response.decode().split('\n') if line.startswith('data:')]
            
            assert len(lines) == 3
            
            data1 = json.loads(lines[0].lstrip('data: '))
            assert data1['type'] == 'content'
            assert data1['content'] == 'Mock stream response part 1'
            
            data2 = json.loads(lines[1].lstrip('data: '))
            assert data2['type'] == 'content'
            assert data2['content'] == 'Mock stream response part 2'
            
            data3 = json.loads(lines[2].lstrip('data: '))
            assert data3['type'] == 'complete'