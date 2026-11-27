"""REST API のレスポンスの形。

drf-spectacular がここから OpenAPI スキーマ（``backend/openapi.json``）を作り、
frontend と拡張機能の orval がそのスキーマから TypeScript の型とクライアントを作る。
クラス名から ``Serializer`` を除いたものがスキーマ名（= TypeScript の型名）になる。

``data`` / ``label`` は DRF の ``Serializer`` / ``Field`` が持つ属性と同名なので、
スタブ上は代入の型が合わない（実行時はメタクラスがフィールドとして取り出す）。
"""

from rest_framework import serializers

from announcements.models import Announcement


class ApiMessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class VersionCheckResultSerializer(serializers.Serializer):
    is_possible = serializers.BooleanField(
        help_text="拡張機能のバージョンが backend の要求を満たすか。"
    )


class LobbyRedirectSerializer(serializers.Serializer):
    redirect_url = serializers.URLField(help_text="dアニメストアの再生ページの URL。")
    part_id = serializers.CharField()
    room_id = serializers.UUIDField()
    title = serializers.CharField(
        allow_blank=True, help_text="作品名。古い拡張機能が作ったルームでは空文字。"
    )


class CountSerializer(serializers.Serializer):
    count = serializers.IntegerField()


class CountResultSerializer(serializers.Serializer):
    data = CountSerializer()  # type: ignore[assignment]


class PerDayCountSerializer(serializers.Serializer):
    day = serializers.DateField()
    count = serializers.IntegerField()


class PerDayResultSerializer(serializers.Serializer):
    data = PerDayCountSerializer(many=True)  # type: ignore[assignment]


class HourlyAverageSerializer(serializers.Serializer):
    hour = serializers.IntegerField(
        min_value=0,
        max_value=23,
        help_text="時間帯（0〜23 時。サーバのタイムゾーン）。",
    )
    average = serializers.FloatField(
        help_text="その時間帯に入室したユーザー数の 1 日あたりの平均。"
    )


class HourlyAverageResultSerializer(serializers.Serializer):
    data = HourlyAverageSerializer(many=True)  # type: ignore[assignment]


class ReactionTypeCountSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    reaction_type = serializers.CharField()


class ReactionTypeCountResultSerializer(serializers.Serializer):
    data = ReactionTypeCountSerializer(many=True)  # type: ignore[assignment]


class ShieldsBadgeSerializer(serializers.Serializer):
    """shields.io の endpoint badge（https://shields.io/badges/endpoint-badge）。"""

    schemaVersion = serializers.IntegerField()  # noqa: N815
    label = serializers.CharField()  # type: ignore[assignment]
    message = serializers.CharField()
    color = serializers.CharField(required=False)
    cacheSeconds = serializers.IntegerField(required=False)  # noqa: N815


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ("id", "message", "level", "starts_at", "ends_at")
        # 応答専用。read_only にするとスキーマで全項目が必須になる。
        read_only_fields = fields
        # 管理画面向けの help_text の代わりに、クライアント向けの説明をスキーマに載せる。
        extra_kwargs = {
            "message": {
                "help_text": (
                    "本文（管理画面で入力した生の文字列）。Markdown のインラインリンク "
                    "`[テキスト](URL)` を含むことがある（ほかの Markdown は含めない）。"
                    "リンクとして描画してよいのは、URL が https:// で始まってホストがあり、"
                    "空白・制御文字・バックスラッシュ・ユーザー情報を含まず、テキストが空でない"
                    "ものだけ。それ以外は元の文字列のまま出す。HTML として解釈しないこと。"
                )
            }
        }


class AnnouncementListResultSerializer(serializers.Serializer):
    data = AnnouncementSerializer(many=True)  # type: ignore[assignment]
