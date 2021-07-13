{%- set dest_version = pillar.metalk8s.cluster_version %}
{%- set master_nodes = salt.metalk8s.minions_by_role('master') %}

{%- for node in master_nodes | sort %}

Sync {{ node }} minion:
  salt.function:
    - name: saltutil.sync_all
    - tgt: {{ node }}
    - kwarg:
        saltenv: metalk8s-{{ dest_version }}

Check pillar on {{ node }}:
  salt.function:
    - name: metalk8s.check_pillar_keys
    - tgt: {{ node }}
    - kwarg:
        keys:
          - metalk8s.endpoints.repositories
        # We cannot raise when using `salt.function` as we need to return
        # `False` to have a failed state
        # https://github.com/saltstack/salt/issues/55503
        raise_error: False
    - retry:
        attempts: 5
    - require:
      - salt: Sync {{ node }} minion

Deploy apiserver {{ node }} to {{ dest_version }}:
  salt.state:
    - tgt: {{ node }}
    - sls:
      - metalk8s.kubernetes.apiserver
    - saltenv: metalk8s-{{ dest_version }}
    - require:
      - salt: Check pillar on {{ node }}
  {%- if loop.previtem is defined %}
      - salt: Deploy apiserver {{ loop.previtem }} to {{ dest_version }}
  {%- endif %}

{%- endfor %}
