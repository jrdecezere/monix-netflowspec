#!/bin/sh
# Gera a configuracao final do nfacctd a partir do modelo e das variaveis de
# ambiente (o pmacct nao le variaveis sozinho), e inicia o coletor.
# Use senhas sem os caracteres  |  &  \  (ex.: openssl rand -hex 16).
set -eu

: "${SQL_HOST:=mysql}"
: "${SQL_PORT:=3306}"
: "${SQL_DB:?defina SQL_DB}"
: "${SQL_USER:?defina SQL_USER}"
: "${SQL_PASSWD:?defina SQL_PASSWD}"

sed \
  -e "s|@SQL_HOST@|${SQL_HOST}|g" \
  -e "s|@SQL_PORT@|${SQL_PORT}|g" \
  -e "s|@SQL_DB@|${SQL_DB}|g" \
  -e "s|@SQL_USER@|${SQL_USER}|g" \
  -e "s|@SQL_PASSWD@|${SQL_PASSWD}|g" \
  /etc/pmacct/nfacctd.conf > /tmp/nfacctd.conf

exec /usr/local/sbin/nfacctd -f /tmp/nfacctd.conf
