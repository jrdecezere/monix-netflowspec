# Fase 0: validação e preparação (Huawei)

## Situação

| Item | Status |
|---|---|
| Huawei suporta BGP Flowspec | Confirmado (informado pelo responsável). Equipamento (`display version`): **NetEngine 8000 M8, VRP 8.200, V800R012C10SPC300**. A versão "R024" citada antes não é a deste roteador |
| Servidor do coletor (Linux + Docker) | Pendente: hoje roda no Docker desktop de desenvolvimento |
| Exportação NetStream/NetFlow para o coletor | Pendente: configurar no(s) roteador(es) |
| Roteador de laboratório para testar flowspec | Pendente (necessário só na Fase 3) |

## Dados a levantar

- Modelo do roteador (NE40E, NE8000, ME60, AR...) e versão do VRP: `display version`
- Interfaces de **entrada de trânsito/peering** que serão monitoradas (nome e `ifIndex`)
- IP de origem do export (de preferência um loopback estável) e IP do servidor do coletor
- Taxa de amostragem desejada (1:1000 é um bom começo; 1:2000 ou mais em links muito grandes)
- ASN local, e se haverá route reflector entre o ExaBGP e os roteadores (Fase 3)
- Se o servidor do coletor alcança os roteadores por UDP/2055 (firewall, ACL de gerência)

## Configuração do NetStream no roteador (modelo)

> Referência de terceiros, não da documentação oficial. **A sintaxe varia por modelo
> e versão do VRP: confirme no HedEx do seu equipamento antes de aplicar em produção.**

```
system-view
 ip netstream timeout active 1               # exporta fluxos longos a cada 1 min (padrão: 30 min)
 ip netstream export version 9               # confira se o seu VRP suporta IPFIX
 ip netstream export source <LOOPBACK-DO-ROTEADOR>
 ip netstream export host <IP-DO-COLETOR> 2055
 interface <UPLINK>
  ip netstream sampler fix-packets 1000 inbound    # amostragem 1:1000 na entrada
  ip netstream inbound                              # ativa a coleta na interface
```

Um guia da FastNetMon testado em NE40 usa amostragem 1:1000 e, em vez do timeout ativo de 1 min, os timeouts globais em segundos (`ip netstream timeout active 15`, `ip netstream timeout inactive 15`, `ip netstream export version 9`, `ip netstream as-mode 32`). Vale testar os dois e ficar com o que o seu VRP aceitar e que entregar fluxos mais rápido.

Pontos de atenção:

- **Modelo importa para o flowspec:** na lista de desvios (YANG) do NE8000-M8/M14 algumas opções de BGP Flowspec, como a checagem do AS de origem, aparecem como não suportadas. Confirme as opções no guia do seu modelo.
- **Timeout ativo**: com o padrão de 30 min a detecção de ataque atrasa o mesmo tempo. Use 1 min ou menos.
- **Sentido**: coletar na **entrada** (`inbound`) dos uplinks mostra o que chega aos clientes. Para ver clientes atacando para fora, colete também na entrada das interfaces de clientes (Fase 5).
- **Taxa de amostragem**: se o roteador não informar a taxa no próprio export, informe em `pmacct/sampling.map` (`id=1000 ip=<IP-DO-ROTEADOR>`). Sem isso os números ficam 1000 vezes menores.
- Alguns equipamentos não informam a taxa de amostragem dentro do export; por isso valide sempre comparando a banda do painel com o contador da interface (`display interface`).

## Validação da Fase 1 com o roteador real

1. `docker compose up -d` e conferir `docker logs sosisp-nfacctd` (sem erros).
2. Aplicar a configuração acima em **uma** interface de teste.
3. Em até ~1 minuto o exportador aparece em *Interfaces e exportadores* no painel (`/sistema`).
4. Comparar a banda do painel com o contador da interface do roteador. A diferença deve ficar abaixo de ~10–15%. Se for ~1000x menor, falta a taxa de amostragem (sampling.map); se for ~1000x maior, a taxa foi aplicada duas vezes.
5. Só depois ampliar para os demais uplinks.

## Teste sem roteador

```bash
node tools/netflow-gen.mjs --seconds 120 --attack ntp      # ntp | dns | memcached | syn
```

## Flowspec (referência para a Fase 3)

Na Huawei, o recebimento de flowspec é uma família de endereços BGP própria, ativada por vizinho, e a validação de rotas flowspec costuma precisar ser ajustada para o vizinho ExaBGP. Ponto de partida de terceiros: [made4it: FlowSpec em Huawei](https://made4it.com.br/en/?p=19012). **Confirmar a sintaxe exata no HedEx do modelo** e testar primeiro em laboratório, com política de importação restrita (aceitar apenas regras vindas do ExaBGP e apenas para prefixos de clientes).

## Fontes

- [FastNetMon: roteadores Huawei (testado em NE40)](https://fastnetmon.com/huawei-routers-configuration-with-fastnetmon-advanced/)
- [Huawei NE8000-M8/M14: desvios do módulo BGP Flowspec](https://www.netconfcentral.org/modules/huawei-bgp-flow-deviations-NE8000M8M14/2020-08-11/source/raw)
- [made4it: NetFlow em roteadores Huawei](https://made4it.com.br/blog/netflow-configuration-on-huawei-routers/)
- [Plixer: exportação de fluxos na Huawei](https://plixer.com/university/library/exporter-configurations/huawei)
- [made4it: FlowSpec em Huawei](https://made4it.com.br/en/?p=19012)
