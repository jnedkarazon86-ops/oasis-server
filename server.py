import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# تحميل متغيرات البيئة (مثل مفاتيح السر)
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'oasis_2026_default_key')

# تفعيل CORS لدعم تطبيقات الأندرويد والآيفون
CORS(app, resources={r"/*": {"origins": "*"}})

# إعدادات المجلدات وتلقائياً إنشاءها
UPLOAD_ROOT = 'assets'
SUB_FOLDERS = {
    'image': 'images',
    'video': 'videos',
    'audio': 'audio_messages'
}

for folder in SUB_FOLDERS.values():
    os.makedirs(os.path.join(UPLOAD_ROOT, folder), exist_ok=True)

# إعداد SocketIO مع دعم gunicorn/eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 1. فحص الصحة (Health Check)
@app.route('/')
def index():
    return jsonify({
        "status": "active",
        "platform": "Oasis Media Server",
        "time": int(time.time())
    })

# 2. جلب الملفات (خدمة عرض الصور والفيديو في التطبيق)
@app.route('/assets/<path:folder>/<path:filename>')
def serve_media(folder, filename):
    # يسمح بفتح الروابط مثل: /assets/images/photo.jpg
    return send_from_directory(os.path.join(UPLOAD_ROOT, folder), filename)

# 3. المسار الرئيسي لرفع ميديا الكاميرا (API)
@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file shared"}), 400
        
        file = request.files['file']
        media_type = request.form.get('type', 'image') # 'image' أو 'video'
        
        if media_type not in SUB_FOLDERS:
            return jsonify({"error": "Unsupported media type"}), 400

        # توليد اسم فريد: oasis_17000000_photo.jpg
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
        filename = secure_filename(f"oasis_{int(time.time())}.{ext}")
        
        target_path = os.path.join(UPLOAD_ROOT, SUB_FOLDERS[media_type], filename)
        file.save(target_path)

        # الرابط الذي سيخزن في Firebase ويستخدمه التطبيق للعرض
        # سيكون شكله: assets/images/oasis_123.jpg
        final_relative_url = f"assets/{SUB_FOLDERS[media_type]}/{filename}"

        return jsonify({
            "status": "success",
            "url": final_relative_url,
            "filename": filename
        }), 201

    except Exception as e:
        print(f"Server Error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # التشغيل المتوافق مع Render
    port = int(os.environ.get('PORT', 10000))
    socketio.run(app, host='0.0.0.0', port=port)
