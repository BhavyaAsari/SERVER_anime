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