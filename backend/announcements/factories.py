import datetime

import factory
from django.utils import timezone

from .models import Announcement


class AnnouncementFactory(factory.django.DjangoModelFactory):
    """既定では今まさに配信中（1 時間前から 1 時間後まで）の行を作る。"""

    class Meta:
        model = Announcement

    message = "11/30 2:00〜6:00 はメンテナンスのため利用できません"
    starts_at = factory.LazyFunction(
        lambda: timezone.now() - datetime.timedelta(hours=1)
    )
    ends_at = factory.LazyAttribute(
        lambda obj: obj.starts_at + datetime.timedelta(hours=2)
    )
