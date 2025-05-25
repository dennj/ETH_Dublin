import resend

def send_email(to_email: str, subject: str, html_body: str):
    params: resend.Emails.SendParams = {
        "from": "orders@latinum.ai",
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }
    resend.Emails.send(params)
