// SPDX-License-Identifier: Apache-2.0
'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';
'require fs';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

// 定义用于获取进程内存的 RPC
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

// 获取 dae 进程的实时 RSS 内存占用 (KB)
function getDaeMemory() {
    return L.resolveDefault(callProcessExec('/bin/sh', ['-c', "ps -w | grep '[d]ae' | awk '{print $4}'"]), {}).then(function (res) {
        var kb = parseInt(res.stdout);
        return isNaN(kb) ? 0 : kb * 1024; // 转换为 bytes
    });
}

function renderStatus(isRunning) {
    var spanTemp = '<span style="color:%s"><strong>%s %s</strong></span>';
    return isRunning 
        ? spanTemp.format('green', _('InfinityDuck'), _('RUNNING'))
        : spanTemp.format('red', _('InfinityDuck'), _('NOT RUNNING'));
}

function formatMemory(bytes) {
    if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 MB';
    if (bytes >= 1073741824)
        return '%.2f GB'.format(bytes / 1073741824);
    return '%.1f MB'.format(bytes / 1048576);
}

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('duck'),
            // 修改路径为 /usr/bin/dae
            L.resolveDefault(fs.exec('/usr/bin/dae', ['version']), {})
        ]);
    },

    render: function (data) {
        var m, s, o;
        var daeExecRes = data[1] || {};

        // 解析版本号
        var daeVersion = _('N/A');
        if (daeExecRes.stdout) {
            var match = daeExecRes.stdout.match(/v[\d.]+\S*/);
            daeVersion = match ? match[0] : daeExecRes.stdout.trim().split('\n')[0];
        }

        m = new form.Map('duck', _('InfinityDuck'),
            _('eBPF-based Linux high-performance transparent proxy solution.'));

        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.render = function () {
            // 实时轮询：状态和内存占用
            poll.add(function () {
                return Promise.all([
                    getServiceStatus(),
                    getDaeMemory()
                ]).then(function (results) {
                    var isRunning = results[0];
                    var memUsed = results[1];
                    
                    var statusView = document.getElementById('service_status');
                    var memView = document.getElementById('dae_mem');
                    
                    if (statusView) statusView.innerHTML = renderStatus(isRunning);
                    if (memView) memView.innerHTML = isRunning ? formatMemory(memUsed) : '0 MB';
                });
            });

            return E('div', { class: 'cbi-section', id: 'status_bar' }, [
                E('p', { id: 'service_status' }, _('Collecting data…')),
                E('table', { class: 'table' }, [
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td left', style: 'width:30%' }, E('strong', {}, _('Memory Usage'))),
                        E('td', { class: 'td left', id: 'dae_mem' }, '0 MB')
                    ]),
                    E('tr', { class: 'tr' }, [
                        E('td', { class: 'td left', style: 'width:30%' }, E('strong', {}, _('DAE Version'))),
                        E('td', { class: 'td left' }, daeVersion)
                    ])
                ])
            ]);
        };

        s = m.section(form.NamedSection, 'config', 'duck');
        o = s.option(form.Flag, 'enabled', _('Enable'));

        o = s.option(form.Flag, 'scheduled_restart', _('Scheduled Restart'));
        o.rmempty = false;

        o = s.option(form.Value, 'cron_expression', _('Cron Expression'));
        o.depends('scheduled_restart', '1');
        o.placeholder = '0 4 * * *';
        o.rmempty = true;

        o = s.option(form.Value, 'delay', _('Startup Delay'),
            _('Startup delay in seconds.'));
        o.datatype = 'uinteger';
        o.placeholder = '0';
        o.default = '0';

        o = s.option(form.Value, 'config_file', _('Configration file'));
        o.default = '/etc/duck/config.dae';
        o.rmempty = false;
        o.readonly = true;

        o = s.option(form.Flag, 'subscribe_enabled', _('Enable Subscription Download'));
        o.rmempty = false;

        o = s.option(form.Value, 'subscribe_url', _('Subscription URL'),
            _('The URL to download configuration from when starting/restarting. Will use existing config if download fails.'));
        o.depends('subscribe_enabled', '1');
        o.rmempty = true;

        o = s.option(form.Value, 'log_maxbackups', _('Max log backups'),
            _('The maximum number of old log files to retain.'));
        o.datatype = 'uinteger';
        o.placeholder = '1';

        o = s.option(form.Value, 'log_maxsize', _('Max log size'),
            _('The maximum size in megabytes of the log file before it gets rotated.'));
        o.datatype = 'uinteger';
        o.placeholder = '1';

        return m.render();
    }
});
