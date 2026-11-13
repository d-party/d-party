import factory

from .models import DEFAULT_USER_ICON, AnimeRoom, AnimeUser, Setting


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
