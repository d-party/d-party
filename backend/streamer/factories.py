import factory

from .models import (
    DEFAULT_USER_ICON,
    AnimeRoom,
    AnimeUser,
    DmmRoom,
    DmmSetting,
    DmmUser,
    Setting,
)


class AnimeRoomFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AnimeRoom

    part_id = "123456"
    title = factory.Faker("sentence", nb_words=3)


class AnimeUserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AnimeUser

    user_name = factory.Faker("name")
    user_icon = DEFAULT_USER_ICON
    room_id = factory.SubFactory(AnimeRoomFactory)
    is_host = False


class SettingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Setting

    room = factory.SubFactory(AnimeRoomFactory)
    one_way = False
    owner_leave_delete = False
    disable_reaction = False


class DmmRoomFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DmmRoom

    part_id = "c7tzzizzvhuj53zhmpf9aa2c0"
    title = factory.Faker("sentence", nb_words=3)


class DmmUserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DmmUser

    user_name = factory.Faker("name")
    user_icon = DEFAULT_USER_ICON
    room_id = factory.SubFactory(DmmRoomFactory)
    is_host = False


class DmmSettingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DmmSetting

    room = factory.SubFactory(DmmRoomFactory)
    one_way = False
    owner_leave_delete = False
    disable_reaction = False
