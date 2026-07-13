# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2023 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=duck
PKG_VERSION:=2026.07.13
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/olicesx/dae.git
PKG_SOURCE_VERSION:=f303e94cebeda73de63a5ab00652009a12f2384e
PKG_MIRROR_HASH:=skip

PKG_LICENSE:=AGPL-3.0-only
PKG_LICENSE_FILE:=LICENSE
PKG_MAINTAINER:=JohnsonRan <me@ihtw.moe>

PKG_BUILD_DEPENDS:=golang/host bpf-headers
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

GO_PKG:=github.com/daeuniverse/dae
GO_PKG_EXCLUDES:=control/kern/tests

GO_PKG_LDFLAGS:= \
	-s -w -buildid= \
	-linkmode external -extldflags '-static -Wl,-s'
GO_PKG_LDFLAGS_X:= \
	$(GO_PKG)/cmd.Version=$(PKG_VERSION) \
	$(GO_PKG)/common/consts.MaxMatchSetLen_=1024
GO_PKG_TAGS:=trace

PGO_PROFILE:=$(CURDIR)/pprof/default.pgo

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/bpf.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

GO_PKG_BUILD_VARS+= \
	GOFLAGS="-trimpath -buildvcs=false -pgo=auto"

GO_PKG_TARGET_VARS+= \
	CGO_LDFLAGS="$(TARGET_LDFLAGS) -static -Wl,-s" \
	GOEXPERIMENT=newinliner,simd

define Package/duck/Default
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  URL:=https://github.com/olicesx/dae
endef

define Package/duck
  $(call Package/duck/Default)
  TITLE:=A lightweight and high-performance transparent proxy solution
  DEPENDS:=$(GO_ARCH_DEPENDS) \
	+ca-bundle +kmod-sched-core +kmod-sched-bpf \
	+kmod-veth +kmod-xdp-sockets-diag \
	+@KERNEL_XDP_SOCKETS \
	+DUCK_USE_VMLINUX_BTF:vmlinux-btf
endef

define Package/duck/config
	choice
		prompt "BTF source for CO-RE"
		default DUCK_USE_KERNEL_BTF
		depends on PACKAGE_duck

	config DUCK_USE_KERNEL_BTF
		bool "Use kernel BTF (integrated)"
		depends on KERNEL_DEBUG_INFO_BTF

	config DUCK_USE_VMLINUX_BTF
		bool "Use vmlinux-btf package"
	endchoice
endef

define Package/duck-geoip
  $(call Package/duck/Default)
  TITLE:=geoip for duck
  DEPENDS:=+duck +v2ray-geoip
  PKGARCH:=all
endef

define Package/duck-geosite
  $(call Package/duck/Default)
  TITLE:=geosite for duck
  DEPENDS:=+duck +v2ray-geosite
  PKGARCH:=all
endef

define Package/duck/description
  dae, means goose, is a lightweight and high-performance transparent
  proxy solution.

  In order to improve the traffic diversion performance as much as possible,
  dae runs the transparent proxy and traffic diversion suite in the linux
  kernel by eBPF. Therefore, we have the opportunity to make the direct
  traffic bypass the forwarding by proxy application and achieve true direct
  traffic through. Under such a magic trick, there is almost no performance
  loss and additional resource consumption for direct traffic.
endef

define Package/duck/conffiles
/etc/duck/config.dae
/etc/config/duck
endef

DUCK_CFLAGS:= \
	-O2 -Wall -Werror \
	-DMAX_MATCH_SET_LEN=1024 \
	-I$(BPF_HEADERS_DIR)/tools/lib \
	-I$(BPF_HEADERS_DIR)/arch/$(BPF_KARCH)/include/asm/mach-generic

define Build/Prepare
	$(call Build/Prepare/Default)
	[ -f "$(PGO_PROFILE)" ] && $(CP) "$(PGO_PROFILE)" "$(PKG_BUILD_DIR)/default.pgo" || true
endef

define Build/Compile
	( \
		pushd $(PKG_BUILD_DIR) ; \
		export \
		$(GO_GENERAL_BUILD_CONFIG_VARS) \
		$(GO_PKG_BUILD_CONFIG_VARS) \
		$(GO_PKG_BUILD_VARS) \
		BPF_CLANG="$(CLANG)" \
		BPF_STRIP_FLAG="-strip=$(LLVM_STRIP)" \
		BPF_CFLAGS="$(DUCK_CFLAGS)" \
		BPF_TARGET="bpfel,bpfeb" \
		BPF_TRACE_TARGET="$(GO_ARCH)" ; \
		go generate ./control/control.go ; \
		go generate ./trace/trace.go ; \
		popd ; \
	)
	$(call GoPackage/Build/Compile)
endef

define Package/duck/install
	$(call GoPackage/Package/Install/Bin,$(1))

	$(INSTALL_DIR) $(1)/etc/duck/
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/example.dae $(1)/etc/duck/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/duck.config $(1)/etc/config/duck

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/duck.init $(1)/etc/init.d/duck
endef

define Package/duck-geoip/install
	$(INSTALL_DIR) $(1)/usr/share/dae
	$(LN) ../v2ray/geoip.dat $(1)/usr/share/dae/geoip.dat
endef

define Package/duck-geosite/install
	$(INSTALL_DIR) $(1)/usr/share/dae
	$(LN) ../v2ray/geosite.dat $(1)/usr/share/dae/geosite.dat
endef

$(eval $(call GoBinPackage,duck))
$(eval $(call BuildPackage,duck))
$(eval $(call BuildPackage,duck-geoip))
$(eval $(call BuildPackage,duck-geosite))
