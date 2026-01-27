from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure_key'

# تفعيل CORS بشكل كامل لضمان اتصال الموبايل بالسيرفر دون قيود
CORS(app, resources={r"/*": {"origins": "*"}})

# إعداد المجلدات الرئيسية للتخزين
UPLOAD_ROOT = 'assets'
folders = {
    'audio': os.path.join(UPLOAD_ROOT, 'audio_messages'),
    'image': os.path.join(UPLOAD_ROOT, 'images'),
    'video': os.path.join(UPLOAD_ROOT, 'videos')
}

# التأكد من إنشاء المجلدات فور تشغيل السيرفر
for folder_path in folders.values():
    os.makedirs(folder_path, exist_ok=True)

# إعداد SocketIO لضمان التوافق مع خوادم Render
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def health_check():
    return {"status": "online", "system": "Oasis Media Server", "version": "4.0.0"}

# الرابط المسؤول عن عرض الصور والفيديوهات داخل التطبيق
@app.route('/assets/<path:subpath>')
def serve_media(subpath):
    return send_from_directory(UPLOAD_ROOT, subpath)

@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        media_type = request.form.get('type') # 'image', 'video', or 'audio'
        
        if not media_type or media_type not in folders:
            return jsonify({"error": "Invalid media type"}), 400

        # توليد اسم ملف آمن وفريد باستخدام الوقت الحالي
        ext = file.filename.split('.')[-1]
        filename = secure_filename(f"{media_type}_{int(time.time())}.{ext}")
        
        target_folder = folders[media_type]
        filepath = os.path.join(target_folder, filename)
        file.save(filepath)

        # التعديل الذهبي: بناء المسار ليتوافق مع دالة serve_media
        # إذا كان النوع image، سيتم تخزينه في assets/images/filename.jpg
        sub_folder = 'audio_messages' if media_type == 'audio' else f"{media_type}s"
        relative_url = f"assets/{sub_folder}/{filename}"
        
        return jsonify({
            "status": "success",
            "url": relative_url
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # تشغيل السيرفر على المنفذ الذي يحدده Render تلقائياً
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
