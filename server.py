from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time
import eventlet

# إعداد التطبيق
app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure_key'

# تفعيل CORS للسماح بالاتصال من تطبيق الهاتف
CORS(app, resources={r"/*": {"origins": "*"}})

# إعداد المجلدات
UPLOAD_ROOT = 'assets'
folders = {
    'image': os.path.join(UPLOAD_ROOT, 'images'),
    'video': os.path.join(UPLOAD_ROOT, 'videos'),
    'audio': os.path.join(UPLOAD_ROOT, 'audio_messages')
}

for folder_path in folders.values():
    os.makedirs(folder_path, exist_ok=True)

# إعداد SocketIO للدردشة اللحظية (اختياري لو أردت تطويره لاحقاً)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 1. فحص حالة السيرفر
@app.route('/')
def health_check():
    return {
        "status": "online",
        "system": "Oasis Media Server",
        "message": "Ready to receive media from React Native"
    }

# 2. المسار الذي يرسل الصور/الفيديو للتطبيق لعرضها
@app.route('/assets/<path:subpath>')
def serve_media(subpath):
    # هذا المسار يسمح للتطبيق بفتح الروابط مثل: https://your-link.com/assets/images/pic.jpg
    return send_from_directory(UPLOAD_ROOT, subpath)

# 3. المسار المسؤول عن استقبال الصور من الكاميرا
@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        media_type = request.form.get('type', 'image') # افتراضياً صورة إذا لم يحدد
        
        if media_type not in folders:
            media_type = 'image'

        # تأمين اسم الملف وإضافة بصمة زمنية لمنع التكرار
        original_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
        filename = secure_filename(f"oasis_{int(time.time())}.{original_ext}")
        
        target_folder = folders[media_type]
        filepath = os.path.join(target_folder, filename)
        
        # حفظ الملف
        file.save(filepath)

        # بناء الرابط الذي سيتم تخزينه في Firebase
        # ملاحظة: نستخدم 'images' بدلاً من 'image' لتطابق اسم المجلد
        sub_folder = f"{media_type}s" if media_type != 'audio' else 'audio_messages'
        final_url = f"assets/{sub_folder}/{filename}"
        
        print(f"File saved: {final_url}") # للرقابة في سجلات Render

        return jsonify({
            "status": "success",
            "url": final_url
        }), 201

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": "Server error during upload"}), 500

if __name__ == "__main__":
    # الحصول على المنفذ من Render
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port)
