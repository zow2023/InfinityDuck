// SPDX-License-Identifier: Apache-2.0
'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';
'require fs';
'require ui';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

var callProcessExec = rpc.declare({
    object: 'file',
    method: 'exec',
    params: ['command', 'params'],
    expect: { '': {} }
});

function getServiceStatus() {
    return L.resolveDefault(callServiceList('duck'), {}).then(function (res) {
        var isRunning = false;
        try {
            isRunning = res['duck']['instances']['duck']['running'];
        } catch (e) { }
        return isRunning;
    });
}

function getDaeMemory() {
    // 执行 ps 获取 dae 进程的 RSS 内存 (KB)
    return L.resolveDefault(callProcessExec('/bin/sh', ['-c', "ps -w | grep '[d]ae' | awk '{print $4}'"]), {}).then(function (res) {
        var kb = parseInt(res.stdout);
        return isNaN(kb) ? 0 : kb * 1024;
    });
}

// 格式化：状态 + 内存同行显示
function renderStatus(isRunning, memBytes) {
    if (isRunning) {
        var memStr = formatMemory(memBytes);
        return '<em><b style="color:green">DAE %s</b></em> <span style="color:#666; font-size:0.9em;">(%s: %s)</span>'
            .format(_('RUNNING'), _('Memory Usage'), memStr);
    } else {
        return '<em><b style="color:red">DAE %s</b></em>'.format(_('NOT RUNNING'));
    }
}

function formatMemory(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
    if (bytes >= 1073741824) return '%.2f GB'.format(bytes / 1073741824);
    return '%.1f MB'.format(bytes / 1048576);
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('duck'),
            // 获取版本号逻辑保留
            L.resolveDefault(fs.exec('/usr/bin/dae', ['version']), {})
        ]);
    },

    render: function (data) {
        var m, s, o;
        var daeExecRes = data[1] || {};

        // 1. 解析版本号字符串
        var daeVersion = _('N/A');
        if (daeExecRes.stdout) {
            var match = daeExecRes.stdout.match(/v[\d.]+\S*/);
            daeVersion = match ? match[0] : daeExecRes.stdout.trim().split('\n')[0];
        }

        // 2. 检查重载成功提示
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('reload')) {
            ui.addNotification(null, E('p', _('Service reloaded successfully')), 'success');
            history.replaceState({}, document.title, window.location.pathname);
        }

        m = new form.Map('duck', _('InfinityDuck'),
            _('eBPF-based Linux high-performance transparent proxy solution.'));

        // --- 第一部分：状态栏（包含即时内存） ---
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.render = function () {
            poll.add(function () {
                return Promise.all([getServiceStatus(), getDaeMemory()]).then(function (results) {
                    var view = document.getElementById('dae_status_html');
                    if (view) view.innerHTML = renderStatus(results[0], results[1]);
                });
            });

            return E('div', { class: 'cbi-section' }, [
                E('p', { id: 'dae_status_html' }, E('em', E('b', _('Collecting data...'))))
            ]);
        };

        // --- 第二部分：系统信息（保留版本号显示） ---
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.render = function () {
            return E('div', { class: 'cbi-section' }, [
                E('table', { class: 'table' }, [
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td left', style: 'width:30%' }, E('strong', {}, _('DAE Version'))),
                        E('td', { class: 'td left' }, daeVersion)
                    ])
                ])
            ]);
        };

        // --- 第三部分：常规配置表单 ---
        s = m.section(form.NamedSection, 'config', 'duck');
        o = s.option(form.Flag, 'enabled', _('Enable'));
        
        o = s.option(form.Flag, 'scheduled_restart', _('Scheduled Restart'));
        o.rmempty = false;

        o = s.option(form.Value, 'cron_expression', _('Cron Expression'));
        o.depends('scheduled_restart', '1');
        o.placeholder = '0 4 * * *';

        o = s.option(form.Value, 'config_file', _('Configration file'));
        o.default = '/etc/duck/config.dae';
        o.readonly = true;

        o = s.option(form.Flag, 'subscribe_enabled', _('Enable Subscription Download'));
        
        o = s.option(form.Value, 'subscribe_url', _('Subscription URL'));
        o.depends('subscribe_enabled', '1');

        return m.render();
    }
});
