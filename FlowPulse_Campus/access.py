"""Staff/driver sessions; no default passwords, raw tokens never persisted."""
import hashlib
import hmac
import os
import secrets
import time
from datetime import timedelta
from http.cookies import SimpleCookie, CookieError
from threading import Lock

PASSWORDS = {}
ATTEMPTS = {}
GUARD = Lock()


def configure(announce=False):
    for role in ('staff', 'driver'):
        value = os.environ.get(f'FLOWPULSE_{role.upper()}_PASSWORD')
        if not value:
            value = secrets.token_urlsafe(18)
            if announce:
                print(f'Temporary {role} password (this run only): {value}', flush=True)
        salt = secrets.token_bytes(16)
        PASSWORDS[role] = (salt, hashlib.scrypt(value.encode(), salt=salt, n=16384, r=8, p=1))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def login(db, data, current, address):
    role, password = data.get('role'), data.get('password')
    if role not in ('staff', 'driver') or not isinstance(password, str) or len(password) > 256:
        raise ValueError('Invalid login')
    with GUARD:
        cutoff = time.monotonic()-60
        # Bound memory and enforce attempts per client, including invalid passwords.
        for key in list(ATTEMPTS):
            ATTEMPTS[key] = [x for x in ATTEMPTS[key] if x > cutoff]
            if not ATTEMPTS[key]: del ATTEMPTS[key]
        attempts = ATTEMPTS.setdefault(address, [])
        if len(attempts) >= 6:
            raise ValueError('Too many login attempts; wait one minute')
        attempts.append(time.monotonic())
    if not PASSWORDS:
        configure()
    salt, expected = PASSWORDS[role]
    supplied = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    if not hmac.compare_digest(expected, supplied):
        raise ValueError('Incorrect role or password')
    token = secrets.token_urlsafe(32)
    expiry = (current+timedelta(hours=8)).isoformat(timespec='seconds')
    db.execute('INSERT INTO sessions(token_hash,role,expires_at) VALUES(?,?,?)', (digest(token), role, expiry))
    return token, role


def cookie_token(header):
    cookie = SimpleCookie()
    try:
        cookie.load(header or '')
        return cookie['flowpulse_session'].value if 'flowpulse_session' in cookie else ''
    except CookieError:
        return ''


def role_for(db, header, current):
    token = cookie_token(header)
    row = db.execute('SELECT role FROM sessions WHERE token_hash=? AND julianday(expires_at)>julianday(?)',
                     (digest(token), current.isoformat())).fetchone()
    return row['role'] if row else None


def session_cookie(token, clear=False):
    secure = '; Secure' if os.environ.get('FLOWPULSE_SECURE_COOKIE') == '1' else ''
    return f'flowpulse_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={0 if clear else 28800}{secure}'
