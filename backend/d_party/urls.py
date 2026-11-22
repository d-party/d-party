"""URL routes: the REST API under /api/ and the admin under /admin/."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # nginx が Django へ流すのは /admin/ 配下なので、その中に置く。admin.site.urls が
    # /admin/ 以下をすべて拾うので、それより前に書く。
    path(
        "admin/passkey/",
        include("django_otp_webauthn.urls", namespace="otp_webauthn"),
    ),
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    from django.conf.urls.static import static

    # django-stubs の static() の戻り値型が urlpatterns と合わない。
    urlpatterns += static(  # type: ignore[arg-type]
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
