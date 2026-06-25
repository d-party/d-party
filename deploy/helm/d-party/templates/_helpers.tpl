{{/*
共通ヘルパ。
*/}}

{{- define "d-party.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "d-party.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "d-party.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: d-party
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{/* コンポーネント別 selector ラベル */}}
{{- define "d-party.selectorLabels" -}}
app.kubernetes.io/name: {{ include "d-party.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/* 各コンポーネントの完全名 */}}
{{- define "d-party.django.fullname" -}}{{ include "d-party.fullname" . }}-django{{- end -}}
{{- define "d-party.frontend.fullname" -}}{{ include "d-party.fullname" . }}-frontend{{- end -}}
{{- define "d-party.nginx.fullname" -}}{{ include "d-party.fullname" . }}-nginx{{- end -}}
{{- define "d-party.postgres.fullname" -}}{{ include "d-party.fullname" . }}-postgres{{- end -}}
{{- define "d-party.redis.fullname" -}}{{ include "d-party.fullname" . }}-redis{{- end -}}

{{/* 機微値を載せる Secret 名（existingSecret 優先） */}}
{{- define "d-party.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- include "d-party.fullname" . }}-secret
{{- end -}}
{{- end -}}

{{/* 非機微 env を載せる ConfigMap 名 */}}
{{- define "d-party.configName" -}}{{ include "d-party.fullname" . }}-config{{- end -}}

{{/*
Django/Frontend/migrate が共通で読む env（DB/Redis ホストはコンポーネント名から導出）。
envFrom(ConfigMap+Secret) に加えて、ここで接続ホストを env として注入する。
*/}}
{{- define "d-party.connectionEnv" -}}
- name: DATABASE_HOST
  value: {{ include "d-party.postgres.fullname" . | quote }}
- name: DATABASE_PORT
  value: {{ .Values.postgres.service.port | quote }}
- name: DATABASE_USER
  value: {{ .Values.postgres.auth.username | quote }}
- name: POSTGRES_DB
  value: {{ .Values.postgres.auth.database | quote }}
- name: REDIS_HOST
  value: {{ include "d-party.redis.fullname" . | quote }}
- name: REDIS_PORT
  value: {{ .Values.redis.service.port | quote }}
{{- end -}}
