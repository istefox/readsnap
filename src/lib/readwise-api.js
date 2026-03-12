// Readwise Reader API client

const READWISE_API_URL = 'https://readwise.io/api/v3/save/';

export async function saveToReadwise({ token, html, title, sourceUrl, tags = [] }) {
  // Create a unique URL for the document
  const uniqueUrl = `https://readsnap.ext/${Date.now()}/${encodeURIComponent(sourceUrl || 'unknown')}`;

  const body = {
    url: uniqueUrl,
    html,
    title: title || 'ReadSnap Capture',
    author: 'ReadSnap',
    should_clean_html: false,
    tags: tags.length > 0 ? tags : undefined,
    saved_using: 'ReadSnap',
  };

  // Add source URL as a note if available
  if (sourceUrl) {
    body.summary = `Captured from: ${sourceUrl}`;
  }

  const response = await fetch(READWISE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error('Rate limited by Readwise. Please wait a moment and try again.');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Readwise API error (${response.status}): ${text}`);
  }

  return response.json();
}

export async function validateToken(token) {
  const response = await fetch('https://readwise.io/api/v2/auth/', {
    headers: { Authorization: `Token ${token}` },
  });
  return response.ok;
}
