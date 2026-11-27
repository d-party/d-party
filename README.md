# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                                    |    Stmts |     Miss |   Branch |   BrPart |   Cover |   Missing |
|-------------------------------------------------------- | -------: | -------: | -------: | -------: | ------: | --------: |
| announcements/\_\_init\_\_.py                           |        0 |        0 |        0 |        0 |    100% |           |
| announcements/admin.py                                  |       45 |        0 |        6 |        0 |    100% |           |
| announcements/apps.py                                   |        4 |        0 |        0 |        0 |    100% |           |
| announcements/links.py                                  |       64 |        0 |       26 |        0 |    100% |           |
| announcements/models.py                                 |       68 |        0 |       10 |        0 |    100% |           |
| announcements/versions.py                               |       50 |        0 |       14 |        0 |    100% |           |
| api/\_\_init\_\_.py                                     |        0 |        0 |        0 |        0 |    100% |           |
| api/apps.py                                             |        3 |        0 |        0 |        0 |    100% |           |
| api/serializers.py                                      |       44 |        0 |        0 |        0 |    100% |           |
| api/urls.py                                             |        3 |        0 |        0 |        0 |    100% |           |
| api/views.py                                            |      222 |        0 |       26 |        0 |    100% |           |
| d\_party/\_\_init\_\_.py                                |        0 |        0 |        0 |        0 |    100% |           |
| d\_party/asgi.py                                        |       12 |        0 |        2 |        0 |    100% |           |
| d\_party/client\_ip.py                                  |       24 |        0 |        8 |        0 |    100% |           |
| d\_party/dashboard.py                                   |       23 |        0 |        2 |        0 |    100% |           |
| d\_party/settings.py                                    |       60 |        0 |       10 |        0 |    100% |           |
| d\_party/urls.py                                        |        7 |        0 |        2 |        0 |    100% |           |
| d\_party/workers.py                                     |        4 |        0 |        0 |        0 |    100% |           |
| streamer/\_\_init\_\_.py                                |        0 |        0 |        0 |        0 |    100% |           |
| streamer/admin.py                                       |       58 |        0 |        0 |        0 |    100% |           |
| streamer/apps.py                                        |        3 |        0 |        0 |        0 |    100% |           |
| streamer/consumers.py                                   |      262 |        1 |       82 |        2 |     99% |104-\>exit, 271 |
| streamer/fields.py                                      |       23 |        0 |        4 |        0 |    100% |           |
| streamer/format.py                                      |       93 |        0 |        2 |        0 |    100% |           |
| streamer/management/\_\_init\_\_.py                     |        0 |        0 |        0 |        0 |    100% |           |
| streamer/management/commands/\_\_init\_\_.py            |        0 |        0 |        0 |        0 |    100% |           |
| streamer/management/commands/close\_active\_sessions.py |       20 |        0 |        2 |        0 |    100% |           |
| streamer/management/commands/close\_expired\_rooms.py   |       42 |        0 |        8 |        0 |    100% |           |
| streamer/mixins.py                                      |       35 |        0 |        4 |        0 |    100% |           |
| streamer/models.py                                      |       68 |        0 |        0 |        0 |    100% |           |
| streamer/reactions.py                                   |       28 |        0 |       10 |        0 |    100% |           |
| streamer/repository.py                                  |       75 |        0 |       12 |        0 |    100% |           |
| streamer/routing.py                                     |        3 |        0 |        0 |        0 |    100% |           |
| streamer/util.py                                        |        9 |        0 |        2 |        0 |    100% |           |
| **TOTAL**                                               | **1352** |    **1** |  **232** |    **2** | **99%** |           |


## Setup coverage badge

Below are examples of the badges you can use in your main branch `README` file.

### Direct image

[![Coverage badge](https://raw.githubusercontent.com/d-party/d-party/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

This is the one to use if your repository is private or if you don't want to customize anything.

### [Shields.io](https://shields.io) Json Endpoint

[![Coverage badge](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/d-party/d-party/python-coverage-comment-action-data/endpoint.json)](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

Using this one will allow you to [customize](https://shields.io/endpoint) the look of your badge.
It won't work with private repositories. It won't be refreshed more than once per five minutes.

### [Shields.io](https://shields.io) Dynamic Badge

[![Coverage badge](https://img.shields.io/badge/dynamic/json?color=brightgreen&label=coverage&query=%24.message&url=https%3A%2F%2Fraw.githubusercontent.com%2Fd-party%2Fd-party%2Fpython-coverage-comment-action-data%2Fendpoint.json)](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

This one will always be the same color. It won't work for private repos. I'm not even sure why we included it.

## What is that?

This branch is part of the
[python-coverage-comment-action](https://github.com/marketplace/actions/python-coverage-comment)
GitHub Action. All the files in this branch are automatically generated and may be
overwritten at any moment.