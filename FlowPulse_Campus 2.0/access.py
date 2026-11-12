"""Three named local-demo accounts; salted password checks and hashed session tokens."""
import hashlib
import hmac
import os
import secrets
import time
from datetime import timedelta
from http.cookies import SimpleCookie, CookieError
from threading import Lock

PASSWORDS = {}
ACCOUNTS = {}
DEMO_ACCOUNTS = {
    'staff': {'username':'apu.staff','password':'APUstaff@2026','display_name':'APU Staff'},
    'driver': {'username':'bus.driver','password':'Driver@2026','display_name':'Bus Driver'},
    'student': {'username':'student','password':'Student@2026','display_name':'Student','student_id':'TP123456'},
}
ATTEMPTS = {}
GUARD = Lock()


def configure(announce=False):
    PASSWORDS.clear()
    ACCOUNTS.clear()
    for role, defaults in DEMO_ACCOUNTS.items():
        value = os.environ.get(f'FLOWPULSE_{role.upper()}_PASSWORD',defaults['password'])
        username = os.environ.get(f'FLOWPULSE_{role.upper()}_USERNAME',defaults['username']).strip().lower()
        if not username or username in ACCOUNTS or not value:
            raise ValueError('Each account needs a unique username and a nonempty password')
        account = {'role':role,'username':username,'display_name':defaults['display_name']}
        if role=='student':
            account['student_id']=os.environ.get('FLOWPULSE_STUDENT_ID',defaults['student_id']).strip().upper()
            if not 1<=len(account['student_id'])<=40:raise ValueError('Configure a valid student ID for the student account')
        ACCOUNTS[username]=account
        salt = secrets.token_bytes(16)
        PASSWORDS[role] = (salt, hashlib.scrypt(value.encode(), salt=salt, n=16384, r=8, p=1))
        if announce:print(f'{defaults["display_name"]} account: {username} (see DEMO_ACCOUNTS.md for default demo credentials)',flush=True)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def login(db, data, current, address):
    username,password=data.get('username'),data.get('password')
    if not isinstance(username,str) or not 1<=len(username)<=100 or not isinstance(password,str) or not 1<=len(password)<=256:
        raise ValueError('Enter your username and password')
    attempt_key=(address,username.strip().lower())
    with GUARD:
        cutoff = time.monotonic()-60
        # Bound memory and enforce attempts per client, including invalid passwords.
        for key in list(ATTEMPTS):
            ATTEMPTS[key] = [x for x in ATTEMPTS[key] if x > cutoff]
            if not ATTEMPTS[key]: del ATTEMPTS[key]
        attempts = ATTEMPTS.setdefault(attempt_key, [])
        if len(attempts) >= 6:
            raise ValueError('Too many login attempts; wait one minute')
        attempts.append(time.monotonic())
    if not PASSWORDS:
        configure()
    account=ACCOUNTS.get(username.strip().lower())
    # Use a real hash even for unknown usernames; never trust a claimed role.
    role=account['role'] if account else 'student'
    salt, expected = PASSWORDS[role]
    supplied = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    if not hmac.compare_digest(expected, supplied) or not account or (data.get('role') and data['role']!=role):
        raise ValueError('The account type, username or password is incorrect')
    with GUARD:ATTEMPTS.pop(attempt_key,None)
    token = secrets.token_urlsafe(32)
    expiry = (current+timedelta(hours=8)).isoformat(timespec='seconds')
    db.execute('INSERT INTO sessions(token_hash,role,expires_at,username,student_id) VALUES(?,?,?,?,?)',
               (digest(token),role,expiry,account['username'],account.get('student_id')))
    return token, role


def cookie_token(header):
    cookie = SimpleCookie()
    try:
        cookie.load(header or '')
        return cookie['flowpulse_session'].value if 'flowpulse_session' in cookie else ''
    except CookieError:
        return ''


def role_for(db, header, current):
    identity=identity_for(db,header,current)
    return identity['role'] if identity else None


def identity_for(db, header, current):
    token = cookie_token(header)
    row = db.execute('SELECT role,username,student_id FROM sessions WHERE token_hash=? AND julianday(expires_at)>julianday(?)',
                     (digest(token), current.isoformat())).fetchone()
    if not row or not row['username']:return None
    return {**dict(row),'display_name':DEMO_ACCOUNTS[row['role']]['display_name']}


def account_options():
    if not ACCOUNTS:configure()
    return [{'role':a['role'],'username':a['username'],'display_name':a['display_name']} for a in ACCOUNTS.values()]


def home(role):
    return {'staff':'/staff','driver':'/driver','student':'/student'}.get(role,'/login.html')


def session_cookie(token, clear=False):
    secure = '; Secure' if os.environ.get('FLOWPULSE_SECURE_COOKIE') == '1' else ''
    return f'flowpulse_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={0 if clear else 28800}{secure}'
