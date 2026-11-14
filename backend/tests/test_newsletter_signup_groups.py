from app.modules.email.models import NewsletterSubscriber
from app.modules.newsletter.schemas import NewsletterSubscribe
from app.modules.newsletter.routes import _apply_signup


def test_resubscribe_preserves_operator_groups_and_adds_source_once():
    subscriber = NewsletterSubscriber(email="qa@example.com", name="QA", groups=["QA", "VIP"], status="unsubscribed")
    payload = NewsletterSubscribe(email="qa@example.com", groups=["public", "QA"])
    _apply_signup(subscriber, payload)
    _apply_signup(subscriber, payload)
    assert subscriber.groups == ["QA", "VIP", "public"]
    assert subscriber.name == "QA"
    assert subscriber.status == "subscribed"


def test_blank_groups_preserve_existing_segments():
    subscriber = NewsletterSubscriber(email="qa@example.com", groups=["QA"])
    _apply_signup(subscriber, NewsletterSubscribe(email="qa@example.com"))
    assert subscriber.groups == ["QA"]
