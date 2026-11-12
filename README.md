# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                                    |    Stmts |     Miss |   Cover |   Missing |
|-------------------------------------------------------- | -------: | -------: | ------: | --------: |
| api/\_\_init\_\_.py                                     |        0 |        0 |    100% |           |
| api/apps.py                                             |        4 |        0 |    100% |           |
| api/urls.py                                             |        3 |        0 |    100% |           |
| api/views.py                                            |      201 |       34 |     83% |129-132, 144, 209-217, 228, 249, 267, 283-292, 301, 310, 319, 327, 332-334, 344, 349-351, 385 |
| d\_party/\_\_init\_\_.py                                |        0 |        0 |    100% |           |
| d\_party/settings.py                                    |       43 |        3 |     93% |     25-28 |
| d\_party/urls.py                                        |        7 |        2 |     71% |     13-16 |
| streamer/\_\_init\_\_.py                                |        0 |        0 |    100% |           |
| streamer/admin.py                                       |       54 |        6 |     89% |18, 26, 38, 55, 60, 65 |
| streamer/apps.py                                        |        4 |        0 |    100% |           |
| streamer/consumers.py                                   |      312 |       40 |     87% |44-51, 58, 68, 192-193, 229, 258, 273-282, 289-300, 312, 332-336, 342, 369, 417-422, 530, 543 |
| streamer/cron.py                                        |       10 |        0 |    100% |           |
| streamer/factories.py                                   |       25 |        0 |    100% |           |
| streamer/fields.py                                      |       23 |        3 |     87% |33, 38, 43 |
| streamer/format.py                                      |       55 |        1 |     98% |        78 |
| streamer/management/\_\_init\_\_.py                     |        0 |        0 |    100% |           |
| streamer/management/commands/\_\_init\_\_.py            |        0 |        0 |    100% |           |
| streamer/management/commands/close\_active\_sessions.py |       16 |        0 |    100% |           |
| streamer/mixins.py                                      |       38 |        7 |     82% |31, 34, 64, 70-71, 74, 77 |
| streamer/models.py                                      |       62 |        1 |     98% |        96 |
| streamer/util.py                                        |        9 |        0 |    100% |           |
| **TOTAL**                                               |  **866** |   **97** | **89%** |           |


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