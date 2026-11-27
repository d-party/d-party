"""backend と拡張機能・フロントの間の契約が、両側で同じ値になっていることのテスト。

``format.py`` ⇔ ``extension/src/domain/protocol.ts`` は手で書いて揃えている。backend の
テストは backend の実装としか比べられないので、ここで TypeScript 側の定義を読んで比べる。
"""

import re
from pathlib import Path

from . import consumers
from .consumers import BasePartyConsumer
from .format import ResponseBaseFormat
from .management.commands import close_expired_rooms
from .models import ReactionType

REPO_ROOT = Path(__file__).resolve().parents[2]
PROTOCOL_TS = (REPO_ROOT / "extension/src/domain/protocol.ts").read_text()
OUTGOING_TS, INCOMING_TS = PROTOCOL_TS.split("// Incoming (server -> client).")

# タイマー画面（frontend）だけが使い、拡張機能の protocol.ts には無いアクション。
FRONTEND_ONLY_ACTIONS = {"spectate"}


def _actions(typescript: str) -> set[str]:
    return set(re.findall(r'^\s+action: "(\w+)";', typescript, flags=re.MULTILINE))


def test_client_actions_match_the_consumer():
    # dアニメストアと DMM TV の consumer はこの基底の action をそのまま使う。
    consumer_actions = {
        name
        for name, member in vars(BasePartyConsumer).items()
        if getattr(member, "action", False)
    }

    assert _actions(OUTGOING_TS) | FRONTEND_ONLY_ACTIONS == consumer_actions


def test_server_actions_match_format():
    server_actions = {
        message.model_fields["action"].default
        for message in ResponseBaseFormat.__subclasses__()
    }

    assert _actions(INCOMING_TS) | FRONTEND_ONLY_ACTIONS == server_actions


def test_server_message_types_match_the_ones_the_backend_sends():
    (union,) = re.findall(r"message_type: ([^;]+);", INCOMING_TS)
    sent = set()
    for module in (consumers, close_expired_rooms):
        source = Path(module.__file__).read_text()
        sent |= set(re.findall(r'message_type="(\w+)"', source))

    assert set(re.findall(r'"(\w+)"', union)) == sent


def test_reaction_names_match_the_extension():
    reactions_ts = (REPO_ROOT / "extension/src/domain/reactions.ts").read_text()
    (names,) = re.findall(r"REACTION_TYPES = \[(.*?)\]", reactions_ts, flags=re.DOTALL)

    assert set(re.findall(r'"(\w+)"', names)) == set(ReactionType.names)


def test_reaction_labels_match_the_stats_page():
    """統計 API は ``reaction_type`` に label を返し、フロントはそれをキーに引く。"""
    dashboard = (
        REPO_ROOT / "frontend/src/components/stats/StatsDashboard.tsx"
    ).read_text()
    (meta,) = re.findall(
        r"const REACTION_META.*?= \{(.*?)\n\};", dashboard, flags=re.DOTALL
    )

    assert set(re.findall(r"^\s+(\w+): \{", meta, flags=re.MULTILINE)) == set(
        ReactionType.labels
    )
