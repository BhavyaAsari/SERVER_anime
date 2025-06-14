// Update your fetchUserProfile function
async function fetchUserProfile() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'GET',
      credentials: 'include', // ✅ This sends session cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('User not authenticated');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch failed:', error);
    return null;
  }
}

// Update your login function
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include', // ✅ Important for setting session
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    const result = await response.text();
    console.log(result); // "Login successful"
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

// Update your logout function
async function logout() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include', // ✅ Important for clearing session
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Logout failed');
    }
    
    const result = await response.text();
    console.log(result); // "Logged out successfully"
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

// Update any other API calls (reviews, messages, etc.)
async function submitReview(reviewData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews`, {
      method: 'POST',
      credentials: 'include', // ✅ Include in all authenticated requests
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit review');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Review submission error:', error);
    throw error;
  }
}

// Example for file uploads (profile pictures)
async function uploadProfilePicture(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/upload-profile-pic`, {
      method: 'POST',
      credentials: 'include', // ✅ Include for authenticated file uploads
      body: formData // Don't set Content-Type for FormData
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// ✅ Direct Message / Chat API Functions
// Create or get existing one-on-one chat
async function createOrGetChat(otherUserId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/one-on-one`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ otherUserId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create/get chat');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Create chat error:', error);
    throw error;
  }
}

// Get chat list
async function getChatList() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/one-on-one/chatlist`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get chat list');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get chat list error:', error);
    throw error;
  }
}

// Get messages for a specific chat
async function getChatMessages(chatId, page = 1, limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/one-on-one/${chatId}/messages?page=${page}&limit=${limit}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get messages');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get messages error:', error);
    throw error;
  }
}

// Send message in chat
async function sendMessage(chatId, content, messageType = 'text') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/one-on-one/${chatId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, messageType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

// ✅ Other Auth API Functions
// Get current user info
async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return null; // User not authenticated
      }
      throw new Error('Failed to get user info');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

// Search users
async function searchUsers(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Search users error:', error);
    throw error;
  }
}

// Update profile
async function updateProfile(username, email) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
}

// Delete profile picture
async function deleteProfilePicture() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/delete-profile-pic`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete profile picture');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Delete profile picture error:', error);
    throw error;
  }
}