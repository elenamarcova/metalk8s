#!jinja | metalk8s_kubernetes

{%- from "metalk8s/repo/macro.sls" import build_image_name with context %}
{% import_yaml 'metalk8s/addons/logging/loki/config/loki.yaml' as loki_defaults with context %}
{%- set loki = salt.metalk8s_service_configuration.get_service_conf('metalk8s-logging', 'metalk8s-loki-config', loki_defaults) %}

{% raw %}

apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
spec:
  allowPrivilegeEscalation: false
  fsGroup:
    ranges:
    - max: 65535
      min: 1
    rule: MustRunAs
  hostIPC: false
  hostNetwork: false
  hostPID: false
  privileged: false
  readOnlyRootFilesystem: true
  requiredDropCapabilities:
  - ALL
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  supplementalGroups:
    ranges:
    - max: 65535
      min: 1
    rule: MustRunAs
  volumes:
  - configMap
  - emptyDir
  - persistentVolumeClaim
  - secret
  - projected
  - downwardAPI
---
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations: {}
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
rules:
- apiGroups:
  - extensions
  resourceNames:
  - loki
  resources:
  - podsecuritypolicies
  verbs:
  - use
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: loki
subjects:
- kind: ServiceAccount
  name: loki
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
    variant: headless
  name: loki-headless
  namespace: metalk8s-logging
spec:
  clusterIP: None
  ports:
  - name: http-metrics
    port: 3100
    protocol: TCP
    targetPort: http-metrics
  selector:
    app: loki
    release: loki
---
apiVersion: v1
kind: Service
metadata:
  annotations: {}
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
spec:
  ports:
  - name: http-metrics
    port: 3100
    protocol: TCP
    targetPort: http-metrics
  selector:
    app: loki
    release: loki
  type: ClusterIP
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  annotations: {}
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: loki
  name: loki
  namespace: metalk8s-logging
spec:
  podManagementPolicy: OrderedReady
  replicas: {% endraw -%}{{ loki.spec.deployment.replicas }}{%- raw %}
  selector:
    matchLabels:
      app: loki
      release: loki
  serviceName: loki-headless
  template:
    metadata:
      annotations:
        checksum/config: f6917e98336282f93b8cf80b99ca1e78f7adfd297b98c367c1cc420a1cb8d1ac
        prometheus.io/port: http-metrics
        prometheus.io/scrape: 'true'
      labels:
        app: loki
        name: loki
        release: loki
    spec:
      affinity: {}
      containers:
      - args:
        - -config.file=/etc/loki/loki.yaml
        env: null
        image: {% endraw -%}{{ build_image_name("loki", False) }}{%- raw %}:1.5.0
        imagePullPolicy: IfNotPresent
        livenessProbe:
          httpGet:
            path: /ready
            port: http-metrics
          initialDelaySeconds: 45
        name: loki
        ports:
        - containerPort: 3100
          name: http-metrics
          protocol: TCP
        readinessProbe:
          httpGet:
            path: /ready
            port: http-metrics
          initialDelaySeconds: 45
        resources: {}
        securityContext:
          readOnlyRootFilesystem: true
        volumeMounts:
        - mountPath: /etc/loki
          name: config
        - mountPath: /data
          name: storage
          subPath: null
      initContainers: []
      nodeSelector: {}
      securityContext:
        fsGroup: 10001
        runAsGroup: 10001
        runAsNonRoot: true
        runAsUser: 10001
      serviceAccountName: loki
      terminationGracePeriodSeconds: 4800
      tolerations:
      - effect: NoSchedule
        key: node-role.kubernetes.io/bootstrap
        operator: Exists
      - effect: NoSchedule
        key: node-role.kubernetes.io/infra
        operator: Exists
      volumes:
      - name: config
        secret:
          secretName: loki
  updateStrategy:
    type: RollingUpdate
  volumeClaimTemplates:
  - metadata:
      annotations: {}
      name: storage
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 10Gi
      storageClassName: metalk8s-loki
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  labels:
    app: loki
    app.kubernetes.io/managed-by: salt
    app.kubernetes.io/name: loki
    app.kubernetes.io/part-of: metalk8s
    chart: loki-0.30.2
    heritage: metalk8s
    release: prometheus-operator
  name: loki
  namespace: metalk8s-logging
spec:
  endpoints:
  - port: http-metrics
  namespaceSelector:
    matchNames:
    - metalk8s-logging
  selector:
    matchLabels:
      app: loki
      release: loki
      variant: headless

{% endraw %}
