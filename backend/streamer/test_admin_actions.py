"""論理削除の管理画面アクション（``logically_delete`` / ``revive``）の権限のテスト。

どちらも ``deleted_at`` を書き換える書き込みなので、閲覧権限だけの staff には
出さない。変更権限か削除権限のどちらかを持っていれば、両方とも使える。
"""

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission, User
from django.test import RequestFactory

from .models import AnimeReaction, AnimeRoom, AnimeUser

MODELS = [AnimeRoom, AnimeUser, AnimeReaction]
LOGICAL_ACTIONS = {"logically_delete", "revive"}


def _staff_with(model, *actions):
    user = User.objects.create_user(username="staff", is_staff=True)
    codenames = [f"{action}_{model._meta.model_name}" for action in actions]
    user.user_permissions.set(
        Permission.objects.filter(
            content_type__app_label=model._meta.app_label,
            codename__in=codenames,
        )
    )
    # 権限のキャッシュを捨てるため取り直す。
    return User.objects.get(pk=user.pk)


def _actions_for(model, user):
    request = RequestFactory().get("/")
    request.user = user
    return set(admin.site._registry[model].get_actions(request))


@pytest.mark.django_db
@pytest.mark.parametrize("model", MODELS)
def test_view_only_staff_gets_no_logical_deletion_actions(model):
    user = _staff_with(model, "view")
    request = RequestFactory().get("/")
    request.user = user

    # 一覧は開ける（＝アクションのフォームが出る画面に届く）が、アクションは出ない。
    assert admin.site._registry[model].has_view_permission(request)
    assert _actions_for(model, user).isdisjoint(LOGICAL_ACTIONS)


@pytest.mark.django_db
@pytest.mark.parametrize("model", MODELS)
def test_view_and_change_staff_gets_both_actions(model):
    user = _staff_with(model, "view", "change")

    assert _actions_for(model, user) >= LOGICAL_ACTIONS


@pytest.mark.django_db
@pytest.mark.parametrize("model", MODELS)
def test_view_and_delete_staff_gets_both_actions(model):
    user = _staff_with(model, "view", "delete")

    assert _actions_for(model, user) >= LOGICAL_ACTIONS


@pytest.mark.django_db
@pytest.mark.parametrize("model", MODELS)
def test_superuser_gets_both_actions(model):
    user = User.objects.create_superuser(username="root")

    assert _actions_for(model, user) >= LOGICAL_ACTIONS
