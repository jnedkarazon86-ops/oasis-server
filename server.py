from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
import os
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure'

# --- 1. إعدادات الإيميل (Email Verification) ---
# ملاحظة: ضع إيميلك وكلمة سر التطبيقات الحقيقية هنا ليعمل الإرسال
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com' 
app.config['MAIL_PASSWORD'] = 'your-app-password' 
mail = Mail(app)
otp_storage = {}

# --- 2. رابط إعلانات Adsterra الخاص بك ---
ADSTERRA_DIRECT_LINK = "https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807"

# --- 3. إعدادات الاتصال الحي (لأزرار الفيديو، الصوت، والرسائل) ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def index():
    return "Oasis Server: All Systems (Email, Video, Audio, Ads) are Online! 🚀"

# مسار جلب إعدادات الإعلانات للتطبيق كل 15 ثانية
@app.route('/api/ads-config')
def get_ads():
    return jsonify({
        "ad_url": ADSTERRA_DIRECT_LINK,
        "interval": 15000 
    })

# مسار إرسال كود التحقق للإيميل
@app.route('/api/verify-email', methods=['POST'])
def send_verification():
    email = request.json.get('email')
    code = str(random.randint(100000, 999999))
    otp_storage[email] = code
    try:
        msg = Message('كود التحقق من واحة (Oasis)', sender=app.config['MAIL_USERNAME'], recipients=[email])
        msg.body = f'كود التحقق الخاص بك هو: {code}'
        mail.send(msg)
        return jsonify({"status": "sent"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- برمجة أزرار المحادثة (إرسال رسائل وصوت) ---
@socketio.on('new_message')
def handle_msg(data):
    # استقبال وإعادة توجيه النص أو ملف الصوت Base64
    emit('receive_message', data, broadcast=True)

# --- برمجة أزرار الاتصال (فيديو وصوت) ---
@socketio.on('call_signal')
def handle_call(data):
    emit('on_call_received', data, broadcast=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
