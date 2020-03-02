# Default network (external)
locals {
  dns_servers = tolist(
    data.openstack_networking_subnet_v2.access_subnet.dns_nameservers
  )
}

resource "openstack_networking_secgroup_v2" "ingress" {
  count = local.heat.enabled ? 0 : 1

  name        = "${local.prefix}-ingress"
  description = "Security group holding ingress rules"

  delete_default_rules = true
}

resource "openstack_networking_secgroup_rule_v2" "ingress_ssh" {
  count = local.heat.enabled ? 0 : 1

  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.ingress[0].id
}

resource "openstack_networking_secgroup_rule_v2" "ingress_icmp" {
  count = local.heat.enabled ? 0 : 1

  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "icmp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.ingress[0].id
}

resource "openstack_networking_secgroup_rule_v2" "ingress_internal" {
  count = local.heat.enabled ? 0 : 1

  direction         = "ingress"
  ethertype         = "IPv4"
  remote_group_id   = openstack_networking_secgroup_v2.ingress[0].id
  security_group_id = openstack_networking_secgroup_v2.ingress[0].id
}

# Limiting egress rules are only used if we have a Bastion to proxy HTTP
# traffic (in case we need online access)
resource "openstack_networking_secgroup_v2" "restricted_egress" {
  count = var.access_network.online || local.heat.enabled ? 0 : 1

  name        = "${local.prefix}-restricted-egress"
  description = "Security group for offline egress rules"

  delete_default_rules = true
}

resource "openstack_networking_secgroup_rule_v2" "egress_internal" {
  count = var.access_network.online || local.heat.enabled ? 0 : 1

  direction = "egress"
  ethertype = "IPv4"

  # NOTE: since Bastion will always be using the "open-egress" secgroup, and
  #       we want members of this group to still reach it, we rely on the
  #       "ingress" secgroup instead for this rule.
  remote_group_id   = openstack_networking_secgroup_v2.ingress[0].id
  security_group_id = openstack_networking_secgroup_v2.restricted_egress[0].id
}

resource "openstack_networking_secgroup_rule_v2" "egress_link_local" {
  count = var.access_network.online || local.heat.enabled ? 0 : 1

  direction         = "egress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "169.254.169.254/32"
  security_group_id = openstack_networking_secgroup_v2.restricted_egress[0].id
}

resource "openstack_networking_secgroup_rule_v2" "egress_dns" {
  count = (
    var.access_network.online || local.heat.enabled
  ) ? 0 : length(local.dns_servers)

  direction         = "egress"
  ethertype         = "IPv4"
  protocol          = "udp"
  port_range_min    = 53
  port_range_max    = 53
  remote_ip_prefix  = "${element(local.dns_servers, count.index)}/32"
  security_group_id = openstack_networking_secgroup_v2.restricted_egress[0].id
}

# This security group relies on default, open egress rules
resource "openstack_networking_secgroup_v2" "open_egress" {
  count = (
    (local.bastion.enabled || var.access_network.online)
    && ! local.heat.enabled
  ) ? 1 : 0

  name        = "${local.prefix}-open-egress"
  description = "Security group for online egress access"
}
