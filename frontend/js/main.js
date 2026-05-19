let currentUser = null;
let tabState = {
    currentLessonId: null,
    currentLevel: 1,
    lessonData: { transcript: "", translation: "", audioSrc: "", clozeData: [] },
    aiData: { transcript: "", audioB64: "" }
};

// Authentication UI
const AuthUI = {
    isLoginMode: true,

    async init() {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                currentUser = await API.getMe();
            } catch (e) {
                this.logout();
            }
        }
        this.renderHeader();
    },

    openModal(isLogin) {
        this.isLoginMode = isLogin;
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('auth-error').classList.add('hidden');
            this.updateModalUI();
        }
    },

    closeModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
    },

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.updateModalUI();
    },

    updateModalUI() {
        document.getElementById('auth-title').innerText = this.isLoginMode ? "Đăng nhập" : "Đăng ký";
        document.getElementById('btn-auth-submit').innerText = this.isLoginMode ? "Đăng nhập" : "Đăng ký";
        document.getElementById('auth-switch-text').innerText = this.isLoginMode ? "Chưa có tài khoản?" : "Đã có tài khoản?";
        document.getElementById('auth-switch-btn').innerText = this.isLoginMode ? "Đăng ký ngay" : "Đăng nhập ngay";
    },

    async submit() {
        const user = document.getElementById('auth-username').value;
        const pass = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');

        try {
            let data;
            if (this.isLoginMode) {
                data = await API.login(user, pass);
                localStorage.setItem('access_token', data.access_token);
                location.reload(); 
            } else {
                data = await API.register(user, pass);
                alert("Đăng ký thành công! Hãy đăng nhập.");
                this.toggleMode();
            }
        } catch (e) {
            errorEl.innerText = e.message;
            errorEl.classList.remove('hidden');
        }
    },

    renderHeader() {
        const container = document.getElementById('header-auth-container');
        if (!container) return;
        if (currentUser) {
            const btnExtra = currentUser.role === 'admin' 
                ? `<button onclick="switchView('view-admin')" class="bg-gray-100 px-3 py-1 rounded font-bold text-xs cursor-pointer">ADMIN</button>`
                : `<span class="font-bold text-sm text-gray-700">${currentUser.username}</span>`;
            
            container.innerHTML = `
                <div class="flex items-center space-x-4">
                    ${btnExtra}
                    <button onclick="AuthUI.logout()" class="text-xs text-gray-400 cursor-pointer">Đăng Xuất</button>
                </div>`;
        }
    },

    logout() {
        localStorage.removeItem('access_token');
        location.reload();
    }
};

// --- 2. ĐIỀU HƯỚNG VIEW ---
function switchView(viewId) {
    const protectedViews = ['view-dictation', 'view-admin', 'view-speaking'];
    if (protectedViews.includes(viewId) && !currentUser) {
        AuthUI.openModal(true);
        return;
    }

    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    if (viewId === 'view-admin') AdminUI.loadLessonList();
    if (viewId === 'view-dictation') {
        loadUserLessonList(); 
    }
}

function switchDictationTab(tab) {
    const isAI = tab === 'ai';
    
    // Đổi trạng thái nút tab
    document.getElementById('btn-tab-default').className = isAI ? "px-6 py-2 bg-white text-gray-600 font-bold rounded-lg border border-gray-200" : "px-6 py-2 bg-hanred-600 text-white font-bold rounded-lg shadow";
    document.getElementById('btn-tab-ai').className = isAI ? "px-6 py-2 bg-hanred-600 text-white font-bold rounded-lg shadow" : "px-6 py-2 bg-white text-gray-600 font-bold rounded-lg border border-gray-200";

    document.getElementById('panel-default-control').classList.toggle('hidden', isAI);
    document.getElementById('panel-ai-control').classList.toggle('hidden', !isAI);
    
    // Xóa sạch nội dung cũ để không bị lẫn
    document.getElementById('audio-container').innerHTML = '<audio controls style="width: 100%;" src=""></audio>';
    document.getElementById('input-area-container').innerHTML = '';
    document.getElementById('feedback-container').classList.add('hidden');
    document.getElementById('translation-section').classList.add('hidden');
    document.getElementById('translation-box').classList.add('hidden');
    document.getElementById('ai-status').innerText = "";
    
    tabState.currentLessonId = null;
    tabState.aiData = { transcript: "", audioB64: "" };

    if (!isAI) {
        loadDefaultData(1);
    } else {
        renderInputArea(2, []); 
    }
}

// Lessons logic
async function loadDefaultData(id) {
    try {
        const data = await API.getLesson(id);
        tabState.currentLessonId = data.id;
        tabState.currentLevel = Number(data.level); 
        tabState.lessonData = { 
            transcript: data.transcript, 
            translation: data.translation,
            audioSrc: data.audio_src, 
            clozeData: data.cloze_data 
        };

        document.getElementById('feedback-container').classList.add('hidden');
        document.getElementById('translation-box').classList.add('hidden');
        
        // Load Audio
        document.getElementById('audio-container').innerHTML = `<audio controls style="width: 100%;"><source src="${data.audio_src}" type="audio/mp3"></audio>`;
        
        // Load Transcript
        if (data.translation) {
            document.getElementById('translation-box').innerText = data.translation;
            document.getElementById('translation-section').classList.remove('hidden');
        }

        renderInputArea(data.level, data.cloze_data);
    } catch (e) {
        console.error("Lỗi tải bài học:", e);
    }
}

function renderInputArea(level, clozeData) {
    const container = document.getElementById('input-area-container');
    if (!container) return;
    
    const isAI = !document.getElementById('panel-ai-control').classList.contains('hidden');

    if (isAI || Number(level) === 2 || !clozeData || clozeData.length === 0) {
        container.innerHTML = `
            <textarea id="user-input-text" rows="6" 
                class="w-full p-4 border rounded-xl shadow-inner outline-none focus:border-hanred-500" 
                placeholder="Nghe và gõ lại nội dung bài học..."></textarea>`;
    } else {

        let html = '<div class="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl">';
        clozeData.forEach((sentence) => {
            sentence.forEach((item) => {
                if (item.is_blank) {
                    html += `<input type="text" class="cloze-input border-b-2 w-24 text-center text-hanred-600 font-bold">`;
                } else {
                    html += `<span class="py-1 px-0.5">${item.word}</span>`;
                }
            });
            html += '<div class="w-full h-1"></div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }
}

// Scoring

async function submitEval() {
    if (!currentUser) return AuthUI.openModal(true);

    const isAI = !document.getElementById('panel-ai-control').classList.contains('hidden');

    const isTextAreaMode = !!document.getElementById('user-input-text');

    try {
        if (isTextAreaMode || isAI) {
            const inputEl = document.getElementById('user-input-text');
            const userText = inputEl.value.trim();
            if (!userText) return alert("Vui lòng nhập bài làm!");

            const target = isAI ? tabState.aiData.transcript : tabState.lessonData.transcript;
            const res = await API.evaluateFull(target, userText, isAI ? null : tabState.currentLessonId);
            renderFeedback(res); 
        } else {
            const inputs = document.querySelectorAll('.cloze-input');
            const answers = Array.from(inputs).map(i => i.value.trim());
            const res = await API.evaluateCloze(answers, 1, tabState.currentLessonId);
            renderClozeFeedback(res); 
        }
    } catch (e) {
        alert("Lỗi chấm điểm: " + e.message);
    }
}

function renderFeedback(res) {
    const container = document.getElementById('feedback-container');
    container.innerHTML = `
        <div class="p-6 bg-white border-2 border-hanred-600 rounded-2xl text-gray-900 shadow-xl">
            <div class="flex justify-between items-center mb-6">
                <h4 class="text-xl font-bold">Kết quả nghe chép</h4>
                <span class="text-4xl font-black text-hanred-500">${res.score_percent}%</span>
            </div>
            <div class="flex flex-wrap gap-2 leading-loose text-lg">
                ${res.feedback.map(item => {
                    let cls = "";
                    if (item.status === 'correct') cls = "text-green-600"; 
                    else if (item.status === 'wrong_user') cls = "text-red-500 line-through decoration-2"; 
                    else if (item.status === 'hint') cls = "text-hanred-600 font-bold border-b-2 border-hanred-500";
                    else if (item.status === 'missing') cls = "text-gray-400 border-b border-dashed border-gray-400";
                    return `<span class="${cls}">${item.word}</span>`;
                }).join(' ')}
            </div>
        </div>`;
    container.classList.remove('hidden');
}

function renderClozeFeedback(res) {
    const container = document.getElementById('feedback-container');
    container.innerHTML = `
        <div class="p-6 bg-white border-2 border-hanred-600 rounded-2xl shadow-lg">
            <h4 class="text-xl font-bold mb-4">Điểm của bạn: <span class="text-hanred-600">${res.score_percent}%</span></h4>
            <div class="space-y-2">
                ${res.feedback.map(f => `
                    <p class="text-sm">
                        <span class="${f.status==='correct'?'text-green-600':'text-red-600'} font-bold">${f.word}</span> 
                        ${f.status==='wrong'?`<span class="text-gray-400">-> Đúng là: ${f.correct}</span>`:''}
                    </p>
                `).join('')}
            </div>
        </div>`;
    container.classList.remove('hidden');
}

// AI WORKSPACE (UPLOAD & YOUTUBE) 
async function processAIFile() {
    const fileInput = document.getElementById('ai-file-input');
    if (!fileInput.files[0]) return alert("Vui lòng chọn file!");

    const status = document.getElementById('ai-status');
    status.innerText = "Đang xử lý AI (Whisper)...";
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const data = await API.processAIFile(formData);
        tabState.aiData = data;
        
        document.getElementById('audio-container').innerHTML = `
            <audio controls class="w-full">
                <source src="data:audio/mp3;base64,${data.audio_b64}" type="audio/mp3">
            </audio>`;
        
        status.innerText = "Xử lý thành công! Hãy bắt đầu nghe chép.";
        renderInputArea(2, []);
    } catch (e) {
        status.innerText = "Lỗi: " + e.message;
    }
}

async function processYouTube() {
    const url = document.getElementById('youtube-input').value;
    if (!url) return alert("Vui lòng dán link YouTube!");

    const status = document.getElementById('ai-status');
    status.innerText = "Đang tải dữ liệu từ YouTube...";
    
    try {
        const data = await API.processYouTube(url);
        tabState.aiData = data;
        
        document.getElementById('audio-container').innerHTML = `
            <audio controls class="w-full">
                <source src="data:audio/mp3;base64,${data.audio_b64}" type="audio/mp3">
            </audio>`;
            
        status.innerText = "Sẵn sàng!";
        renderInputArea(2, []);
    } catch (e) {
        status.innerText = "Lỗi: " + e.message;
    }
}

// ADMIN UI 
const AdminUI = {
    async loadLessonList() {
        const container = document.getElementById('admin-lesson-management');
        try {
            const lessons = await API.getLessonList();
            if (lessons.length === 0) {
                container.innerHTML = '<p class="text-center py-10 text-gray-400">Chưa có bài học nào.</p>';
                return;
            }
            container.innerHTML = lessons.map(l => `
                <div class="flex justify-between items-center p-4 border-b hover:bg-gray-50 transition">
                    <div>
                        <span class="font-bold text-hanred-600">#${l.id}</span>
                        <span class="ml-2 font-bold text-gray-800">${l.title}</span>
                    </div>
                    <button onclick="AdminUI.delete(${l.id})" class="text-red-500 font-bold hover:underline cursor-pointer">Xóa</button>
                </div>`).join('');
        } catch (e) {
            container.innerHTML = '<p class="text-center py-10 text-red-500">Lỗi: ' + e.message + '</p>';
        }
    },

    async uploadAudio(input) {
        if (!input.files[0]) return;
        
        const textInput = document.getElementById('admin-audio');
        const status = input.nextElementSibling; // Nút chọn file
        
        try {
            status.innerText = "Đang tải...";
            const formData = new FormData();
            formData.append('file', input.files[0]);
            
            const data = await API.uploadAudio(formData);
            
            textInput.value = data.url;
            status.innerText = "Đã chọn";
        } catch (e) { 
            alert("Lỗi tải file: " + e.message); 
            status.innerText = "Chọn file";
        }
    },

    async submitLesson() {
        const payload = {
            title: document.getElementById('admin-title').value,
            level: parseInt(document.getElementById('admin-level').value),
            audio_url: document.getElementById('admin-audio').value,
            transcript: document.getElementById('admin-transcript').value,
            translation: document.getElementById('admin-translation').value
        };

        if (!payload.title || !payload.transcript) {
            return alert("Vui lòng nhập ít nhất là Tiêu đề và Transcript!");
        }

        try {
            await API.addLesson(payload);
            alert("Tạo bài học thành công!");
            
            this.resetForm();
            this.loadLessonList();
        } catch (e) {
            alert("Lỗi khi tạo: " + e.message);
        }
    },


    resetForm() {
        ['admin-title', 'admin-audio', 'admin-transcript', 'admin-translation'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('admin-level').value = '1';
    },
    
    async delete(id) {
        if(confirm("Bạn chắc chắn muốn xóa bài học này?")) {
            try {
                await API.deleteLesson(id);
                this.loadLessonList();
            } catch(e) { alert(e.message); }
        }
    }
};

// --- UTILS ---
function toggleTranslation() {
    const box = document.getElementById('translation-box');
    box.classList.toggle('hidden');
}

function toggleLevel(id) {
    document.getElementById(id).classList.toggle('hidden');
}

AuthUI.init();

async function loadUserLessonList() {
    const soCapContainer = document.getElementById('content-so-cap');
    const trungCapContainer = document.getElementById('content-trung-cap');
    
    if (!soCapContainer || !trungCapContainer) return;

    try {
        const lessons = await API.getLessonList();
        
        soCapContainer.innerHTML = '';
        trungCapContainer.innerHTML = '';

        lessons.forEach(l => {
            const lv = Number(l.level);
            const isBeginner = (l.id <= 2 || lv === 1); 

            const bgColor = isBeginner ? 'bg-green-50' : 'bg-blue-50';
            const borderColor = isBeginner ? 'border-green-200' : 'border-blue-200';
            const textColor = isBeginner ? 'text-green-800' : 'text-blue-800';
            const icon = isBeginner ? 'fa-book' : 'fa-headphones-simple';
            const iconColor = isBeginner ? 'text-green-500' : 'text-blue-500';
            const playColor = isBeginner ? 'text-green-700' : 'text-blue-700';

            const btnHtml = `
                <button onclick="loadDefaultData(${l.id})" 
                    class="w-full ${bgColor} border ${borderColor} ${textColor} p-2 rounded-xl text-sm md:text-base font-bold hover:opacity-80 transition flex justify-between items-center text-left mb-4 shadow-sm cursor-pointer">
                    <div class="flex items-center space-x-3 md:space-x-4">
                        <div class="w-12 h-12 md:w-14 md:h-14 bg-white rounded-lg border ${borderColor} shadow-sm flex items-center justify-center ${iconColor}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <span>${l.title}</span>
                    </div>
                    <i class="fa-solid fa-play mr-2 ${playColor}"></i>
                </button>`;

            if (isBeginner) {
                soCapContainer.insertAdjacentHTML('beforeend', btnHtml);
            } else {
                trungCapContainer.insertAdjacentHTML('beforeend', btnHtml);
            }
        });
    } catch (e) {
        console.error("Lỗi tải danh sách:", e);
    }
}