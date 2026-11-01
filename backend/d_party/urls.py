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

    # django-stubs の static() の戻り値型が urlpatterns と合わない。
    urlpatterns += static(  # type: ignore[arg-type]
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
