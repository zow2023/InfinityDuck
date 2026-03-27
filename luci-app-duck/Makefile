# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2024 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_VERSION:=1.3.6

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=JohnsonRan <me@ihtw.moe>

LUCI_TITLE:=Another LuCI app for dae
LUCI_DEPENDS:=+duck +duck-geoip +duck-geosite

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
