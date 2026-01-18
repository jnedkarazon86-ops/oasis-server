from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_secret_2026'
# تفعيل الـ SocketIO لدعم المراسلة الفورية
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def home():
    return "<h1>Oasis Server is Running</h1><p>Waiting for Real-time Connections...</p>"

# منطق إرسال واستقبال الرسائل الفورية
@socketio.on('send_message')
def handle_message(data):
    # هنا يستلم السيرفر الرسالة ويعيد توجيهها فوراً للطرف الآخر
    print(f"Message received: {data}")
    emit('receive_message', data, broadcast=True)

# منطق إرسال إشارة الاتصال (الفيديو والصوت)
@socketio.on('call_user')
def handle_call(data):
    # يرسل تنبيه للمستخدم الآخر بأن هناك مكالمة واردة
    emit('incoming_call', data, broadcast=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # ملاحظة: نستخدم socketio.run بدلاً من app.run
    socketio.run(app, host='0.0.0.0', port=port)
