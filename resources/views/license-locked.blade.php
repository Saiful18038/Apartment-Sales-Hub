<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Access Restricted</title>
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f1f5f9;
            color: #1e293b;
        }
        .card {
            width: 100%;
            max-width: 420px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            box-shadow: 0 10px 40px -12px rgba(15, 23, 42, .18);
            padding: 40px 36px;
            text-align: center;
        }
        .badge {
            width: 60px;
            height: 60px;
            border-radius: 999px;
            background: #fef2f2;
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        h1 { font-size: 19px; margin: 0 0 8px; }
        p { margin: 0; color: #64748b; font-size: 14px; }
        .note {
            margin-top: 22px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            font-size: 12.5px;
            color: #94a3b8;
        }
        @media (prefers-color-scheme: dark) {
            body { background: #0f172a; color: #e2e8f0; }
            .card { background: #1e293b; border-color: #334155; }
            .badge { background: rgba(239, 68, 68, .12); }
            p { color: #94a3b8; }
            .note { border-color: #334155; color: #64748b; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
        </div>
        <h1>Access Restricted</h1>
        <p>This installation&rsquo;s license has expired. Please contact your software provider to restore access.</p>
        <div class="note">
            Your data is safe and has not been deleted. Normal access resumes as soon as a valid license key is applied.
        </div>
    </div>
</body>
</html>
