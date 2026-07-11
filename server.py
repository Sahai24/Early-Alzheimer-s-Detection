import os
import sqlite3
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='frontend')
DB_FILE = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diagnostic_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            age REAL NOT NULL,
            mmse REAL NOT NULL,
            moca REAL NOT NULL,
            ptau181 REAL NOT NULL,
            ptau217 REAL NOT NULL,
            ab42_ab40_ratio REAL NOT NULL,
            nfl REAL NOT NULL,
            gfap REAL NOT NULL,
            threshold TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            confidence TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# API Endpoints
@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM diagnostic_logs ORDER BY id DESC')
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for r in rows:
            logs.append({
                'id': r['id'],
                'timestamp': r['timestamp'],
                'age': r['age'],
                'mmse': r['mmse'],
                'moca': r['moca'],
                'ptau181': r['ptau181'],
                'ptau217': r['ptau217'],
                'ab42_ab40_ratio': r['ab42_ab40_ratio'],
                'nfl': r['nfl'],
                'gfap': r['gfap'],
                'threshold': r['threshold'],
                'diagnosis': r['diagnosis'],
                'confidence': r['confidence']
            })
        return jsonify(logs), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['POST'])
def add_log():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Missing JSON payload'}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO diagnostic_logs (
                timestamp, age, mmse, moca, ptau181, ptau217, 
                ab42_ab40_ratio, nfl, gfap, threshold, diagnosis, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('timestamp'),
            data.get('age'),
            data.get('mmse'),
            data.get('moca'),
            data.get('ptau181'),
            data.get('ptau217'),
            data.get('ab42_ab40_ratio'),
            data.get('nfl'),
            data.get('gfap'),
            data.get('threshold'),
            data.get('diagnosis'),
            data.get('confidence')
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logs', methods=['DELETE'])
def clear_logs():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM diagnostic_logs')
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Static File Routes
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    init_db()
    # Run server on port 8000
    app.run(host='0.0.0.0', port=8000, debug=True)
