from flask import Flask, jsonify
import os

app = Flask(__name__)

# بيانات الدخول التي ستضعها في الراوتر لاحقاً
VPN_DATA = {
    "username": "oasis_admin",
    "password": "free_connect_2026"
}

@app.route('/')
def home():
    return "<h1>Oasis Server is Running</h1><p>Waiting for Antenna Link...</p>"

@app.route('/connect')
def connect():
    return jsonify({
        "status": "Ready",
        "bridge": "Active",
        "msg": "Satellite Tunnel Open"
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
