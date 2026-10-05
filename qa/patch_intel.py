p = 'src/features/network/NetworkMap.tsx'
s = open(p, encoding='utf8').read()

# The old block contains literal backslash-u sequences; build matchers without
# embedding them as python escapes.
old_lines = [
    '      {incident.location.description && <span>\\ud83d\\udccd {incident.location.description}</span>}',
    '      {incident.location.landmark && <span>\\ud83e\\udded {incident.location.landmark}</span>}',
    '      {incident.location.address && <span>\\ud83c\\udfe0 {incident.location.address}</span>}',
    '      {distanceBearing && <span>\\ud83d\\udcf0 {distanceBearing}</span>}',
]
for line in old_lines:
    assert line in s, "missing: " + line

old_accuracy = '        <span>{t("intelAccuracy", { defaultValue: "GPS accuracy" })} ' + '\\' + '±{incident.location.accuracyMeters} m</span>'
assert old_accuracy in s, "accuracy line not found"

new_rows = (
    '      {incident.location.description && (\n'
    '        <span className="intel-row"><Icons.pin size={13} /> <span>{incident.location.description}</span></span>\n'
    '      )}\n'
    '      {incident.location.landmark && (\n'
    '        <span className="intel-row"><Icons.compass size={13} /> <span>{t("intelNearLandmark", { defaultValue: "near" })} {incident.location.landmark}</span></span>\n'
    '      )}\n'
    '      {incident.location.address && (\n'
    '        <span className="intel-row"><Icons.home size={13} /> <span>{incident.location.address}</span></span>\n'
    '      )}\n'
    '      {distanceBearing && (\n'
    '        <span className="intel-row"><Icons.map size={13} /> <span>{distanceBearing}</span></span>\n'
    '      )}\n'
    '      {incident.location.accuracyMeters != null && (\n'
    '        <span className="intel-row">\n'
    '          <Icons.crosshair size={13} />\n'
    '          <span>\n'
    '            <span className="intel-k">{t("intelAccuracy", { defaultValue: "GPS accuracy" })}</span>\n'
    '            ±{incident.location.accuracyMeters} m\n'
    '          </span>\n'
    '        </span>\n'
    '      )}'
)

for line in old_lines:
    s = s.replace(line + "\n", "")
s = s.replace(old_accuracy, new_rows)

# nearest-place result row: replace emoji bullet with icon
old_ok = '''          {intel.road && <>\\ud83d\\udee3 {intel.road}</>}'''
assert old_ok in s
s = s.replace(old_ok, '''          {intel.road && (
            <span className="intel-row" style={{ display: "flex" }}>
              <Icons.map size={13} />
              <span>
                <span className="intel-k">{t("intelNearestPlace", { defaultValue: "Nearest place" })}</span>
                {intel.road}{intel.road && intel.city ? " · " : ""}{intel.city}
              </span>
            </span>
          )}''')

# title rename (structured heading)
s = s.replace('{t("intelTitle", { defaultValue: "Location intel" })}', '{t("intelTitle", { defaultValue: "Location" })}')

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('patched')
