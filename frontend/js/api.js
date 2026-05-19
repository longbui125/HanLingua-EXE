const API_BASE = '/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
    } : { 
        'Content-Type': 'application/json' 
    };
};

const API = {
    // AUTH
    async register(username, password) {
        const res = await fetch(`${API_BASE}/auth/register`, { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({username, password}) 
        });
        if (!res.ok) throw new Error((await res.json()).detail); 
        return res.json();
    },

    async login(username, password) {
        const fd = new URLSearchParams(); 
        fd.append('username', username); 
        fd.append('password', password);
        
        const res = await fetch(`${API_BASE}/auth/login`, { 
            method: 'POST', 
            headers: {'Content-Type':'application/x-www-form-urlencoded'}, 
            body: fd 
        });
        if (!res.ok) throw new Error((await res.json()).detail); 
        return res.json();
    },

    async getMe() {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Phiên đăng nhập hết hạn"); 
        return res.json();
    },

    //LESSONS
    async getLessonList() {
        const res = await fetch(`${API_BASE}/lessons/list`); 
        if (!res.ok) throw new Error("Không thể tải danh sách bài học");
        return res.json();
    },

    async getLesson(id) {
        const res = await fetch(`${API_BASE}/lessons/${id}`); 
        if (!res.ok) throw new Error("Không tìm thấy bài học");
        return res.json();
    },

    //EVALUATION
    async evaluateFull(targetText, userText, lessonId = null) {
        const res = await fetch(`${API_BASE}/evaluate`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify({ 
                target_text: targetText, 
                user_text: userText, 
                lesson_id: lessonId 
            }) 
        });
        if(res.status === 401) throw new Error("Vui lòng đăng nhập để thực hiện");
        return res.json();
    },

    async evaluateCloze(clozeAnswers, level, lessonId) {
        const res = await fetch(`${API_BASE}/evaluate-cloze`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify({ 
                cloze_answers: clozeAnswers, 
                level, 
                lesson_id: lessonId 
            }) 
        });
        if(res.status === 401) throw new Error("Vui lòng đăng nhập để thực hiện");
        return res.json();
    },

    //ADMIN
    async deleteLesson(id) {
        const res = await fetch(`${API_BASE}/admin/lessons/${id}`, { 
            method: 'DELETE', 
            headers: getAuthHeaders() 
        });
        if(!res.ok) throw new Error("Lỗi khi xóa bài");
        return res.json();
    },

    async addLesson(data) {
        const res = await fetch(`${API_BASE}/admin/lessons`, { 
            method: 'POST', 
            headers: getAuthHeaders(), 
            body: JSON.stringify(data) 
        });
        if(!res.ok) throw new Error("Không thể thêm bài học"); 
        return res.json();
    },

    async updateLesson(id, data) {
        const res = await fetch(`${API_BASE}/admin/lessons/${id}`, { 
            method: 'PUT', 
            headers: getAuthHeaders(), 
            body: JSON.stringify(data) 
        });
        if(!res.ok) throw new Error("Lỗi khi cập nhật bài");
        return res.json();
    },

    async getMyProgress() {
        const res = await fetch(`${API_BASE}/me/progress`, { headers: getAuthHeaders() }); 
        return res.json();
    },

    async getAllProgress() {
        const res = await fetch(`${API_BASE}/admin/progress`, { headers: getAuthHeaders() }); 
        return res.json();
    },

    //AI WORKSPACE 
    async processAIFile(formData) {
        // FormData không cần Header Content-Type thủ công vì trình duyệt sẽ tự thêm
        const res = await fetch(`${API_BASE}/process-ai`, { 
            method: 'POST', 
            body: formData 
        });
        if (!res.ok) throw new Error("Lỗi xử lý file AI");
        return res.json();
    },

        async uploadAudio(formData) {
        const res = await fetch(`${API_BASE}/admin/upload-audio`, {
            method: 'POST',
            body: formData 
        });
        if (!res.ok) throw new Error("Không thể tải lên file");
        return res.json();
    },

    async addLesson(data) {
        const res = await fetch(`${API_BASE}/admin/lessons`, { 
            method: 'POST', 
            headers: getAuthHeaders(), // Phải có Token Admin mới tạo được
            body: JSON.stringify(data) 
        });
        if (!res.ok) throw new Error("Không thể thêm bài học"); 
        return res.json();
    },

    async processYouTube(url) {
        const res = await fetch(`${API_BASE}/process-youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error("Lỗi xử lý link YouTube");
        return res.json();
    }
};