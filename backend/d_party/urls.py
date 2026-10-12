"""URL routes: the REST API under /api/ and the admin under /admin/."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    from django.conf.urls.static import static

    # static() の戻り値型（django-stubs）と urlpatterns の要素型が食い違うが実行時は問題ない。
    urlpatterns += static(  # type: ignore[arg-type]
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
