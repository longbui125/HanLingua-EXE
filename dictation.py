import difflib
import re

def evaluate_dictation(original_text, user_input):
    def clean_word(word):
        # Loại bỏ dấu câu để so sánh chính xác hơn
        return re.sub(r'[.,!?~]+', '', word)

    orig_words = original_text.split()
    user_words = user_input.split()
    orig_clean = [clean_word(w) for w in orig_words]
    user_clean = [clean_word(w) for w in user_words]

    matcher = difflib.SequenceMatcher(None, orig_clean, user_clean)
    feedback = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            # Từ ĐÚNG
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "correct"})
        elif tag == 'replace':
            # SAI: Từ người dùng gõ nhầm (Màu đỏ gạch ngang)
            for word in user_words[j1:j2]:
                feedback.append({"word": word, "status": "wrong_user"})
            # SỬA LẠI: Từ đúng trong kịch bản (Màu vàng)
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "hint"})
        elif tag == 'delete':
            # THIẾU: Từ bị bỏ sót (Màu đỏ)
            for word in orig_words[i1:i2]:
                feedback.append({"word": word, "status": "missing"})
        elif tag == 'insert':
            # THỪA: Từ gõ dư ra (Màu đỏ gạch ngang)
            for word in user_words[j1:j2]:
                feedback.append({"word": word, "status": "wrong_user"})
    
    correct_count = sum(1 for item in feedback if item["status"] == "correct")
    score = int((correct_count / len(orig_words)) * 100) if orig_words else 0
    return {"score_percent": score, "feedback": feedback}