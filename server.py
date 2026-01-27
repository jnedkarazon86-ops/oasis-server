from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure_key'

# تفعيل CORS لضمان اتصال التطبيق بالسيرفر دون قيود
CORS(app, resources={r"/*": {"origins": "*"}})

# إعداد المجلدات الرئيسية للتخزين داخل مجلد assets
UPLOAD_ROOT = 'assets'
folders = {
    'audio': os.path.join(UPLOAD_ROOT, 'audio_messages'),
    'image': os.path.join(UPLOAD_ROOT, 'images'),
    'video': os.path.join(UPLOAD_ROOT, 'videos')
}

# التأكد من إنشاء المجلدات فور تشغيل السيرفر لتجنب أخطاء "المجلد غير موجود"
for folder_path in folders.values():
    os.makedirs(folder_path, exist_ok=True)

# إعداد SocketIO لضمان التوافق مع خوادم Render (استخدام eventlet ضروري)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def health_check():
    return {
        "status": "online",
        "system": "Oasis Media Server",
        "version": "4.5.0",
        "message": "Server is running perfectly"
    }

# المسار المسؤول عن عرض (جلب) الملفات داخل التطبيق
@app.route('/assets/<path:subpath>')
def serve_media(subpath):
    return send_from_directory(UPLOAD_ROOT, subpath)

@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        media_type = request.form.get('type') # المتوقع: 'image' أو 'video' أو 'audio'
        
        if not media_type or media_type not in folders:
            return jsonify({"error": "Invalid media type"}), 400

        # توليد اسم ملف آمن وفريد باستخدام التوقيت الزمني
        # مثال: audio_1738000000.m4a
        ext = file.filename.split('.')[-1]
        filename = secure_filename(f"{media_type}_{int(time.time())}.{ext}")
        
        target_folder = folders[media_type]
        filepath = os.path.join(target_folder, filename)
        
        # حفظ الملف في المجلد المحدد
        file.save(filepath)

        # بناء الرابط الراجع للتطبيق (يتطابق مع دالة serve_media)
        # سيتم إرجاع شيء مثل: assets/audio_messages/filename.m4a
        sub_folder = 'audio_messages' if media_type == 'audio' else f"{media_type}s"
        final_url = f"assets/{sub_folder}/{filename}"
        
        return jsonify({
            "status": "success",
            "url": final_url
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # استخدام المنفذ الذي يحدده Render تلقائياً أو 10000 كافتراضي
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
