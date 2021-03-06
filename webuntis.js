/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   30.09.2020
 *
 *  Library to watch public lessons from webuntis.com
 */

const https = require('https');

const Webuntis = {

    /* searches schools by name, returns a list of matches */
    findSchool: function(search) {
        const data = JSON.stringify({
            id: "wu_schulsuche-1601401688595",
            method: "searchSchool",
            params: [{search: search}],
            jsonrpc: "2.0"
        });

        return new Promise(function(resolve, reject) {
            Webuntis.request('mobile.webuntis.com', '/ms/schoolquery2', data, 'POST').then(
                res => {
                    let result = JSON.parse(res.content);
                    resolve(result["result"] == undefined ? [] : result["result"]["schools"]);
                }, 
                err => reject(err)
            );
        });
    },

    /* Sets cookie `schoolname` for later use. Webuntis needs cookies for identifying school */
    setupCookie: function(school) {
        let path = `/WebUntis/?school=${school.loginName}#/basic/main`;
        return new Promise(function(resolve, reject) {
            Webuntis.request( school.server, path, '', 'GET').then(
                res => {
                    school.cookie = res.cookie[1];
                    resolve(school);
                }, 
                err => reject(err)
            );
        });
    },

    /* Returns a list of departments from school */
    findDepartments: function(school) {
        let path = '/WebUntis/api/public/timetable/weekly/pageconfig?type=1';

        return new Promise(function(resolve, reject) {
            Webuntis.request(school.server, path, '', 'GET', school.cookie).then(
                res => {
                    let result = JSON.parse(res.content).data.filters;

                    if (result.length > 0) {
                        let departments = result[0].elements;
                        departments.forEach(x => x.school = school);
                        resolve(departments);
                    } else {
                        resolve(null);
                    }
                }, 
                err => reject(err)
            );
        });
    },

    /* Returns a list of classes in department/school */
    findClasses: function(section) {
        let isDepartment = section.school != undefined;
        let school = isDepartment ? section.school : section; // section could be school or department
        let path = `/WebUntis/api/public/timetable/weekly/pageconfig?type=1${ isDepartment ? `&filter.departmentId=${section.id}` : '' }`;

        return new Promise(function(resolve, reject) {
            Webuntis.request(school.server, path, '', 'GET', school.cookie).then(
                res => {
                    let classes = JSON.parse(res.content).data.elements;
                    classes.forEach(x => x.section = section);
                    resolve(classes);
                }, 
                err => reject(err)
            );
        });
    },

    /*
        Returns current date in yyyy-mm-dd format, used in webuntis url
        original: https://stackoverflow.com/questions/23593052/format-javascript-date-as-yyyy-mm-dd
    */
    fmDate: function(d, s = '-') {
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join(s);
    },

    /* Returns timetable of class */
    getTimetable: function(clazz) {
        let isDepartment = clazz.section.school != undefined;
        let school = isDepartment ? clazz.section.school : clazz.section;
        let date = new Date();

        if (date.getDay() == 0) { // if sunday, set to next week
            date.setDate(date.getDate() + 1);
        }

        let fmdate = Webuntis.fmDate(date);
        let path = `/WebUntis/api/public/timetable/weekly/data?type=1&date=${fmdate}&elementType=1&elementId=${clazz.id}${ isDepartment ? `&filter.departmentId=${clazz.section.id}` : '' }`;

        return new Promise((resolve, reject) => {
            Webuntis.request(school.server, path, '', 'GET', school.cookie).then(
                res => resolve(JSON.parse(res.content).data.result.data),
                err => reject(err)
            );
        });
    },

    /* Helper function of `mapTimetableToWeek` */
    getElementFromTimetable: function(timetable, type, id) {
        return timetable.elements.find(x => x.type == type && x.id == id);
    },

    /* sorts timetable provided by `getTimetable` to week days -> returns list with 5 elements */
    mapTimetableToWeek: function(timetable) {
        let elementPeriods = timetable.elementPeriods[Object.keys(timetable.elementPeriods)[0]];
        let elements = timetable.elements;
        let lessons = {}, lessonsTrimed = {};
        let idx = 0;
        let i, j;

        for (i in elementPeriods) {
            let lesson = {
                date: elementPeriods[i].date,
                startTime: elementPeriods[i].startTime,
                endTime: elementPeriods[i].endTime,
                name: null,
                room: null,
                state: elementPeriods[i].cellState,
                teachers: [],
            };

            // Fill in generall information stored in `timetable.elements` by its id
            for (j = 0; j < elementPeriods[i].elements.length; ++ j) {
                let e = elementPeriods[i].elements[j];
                let n = Webuntis.getElementFromTimetable(timetable, e.type, e.id).name;
                switch(e.type) {
                case 2: // teacher
                    lesson.teachers.push(n);
                    break;
                case 3: // lesson
                    lesson.name = n;
                    break;
                case 4: // room
                    lesson.room = n;
                    break;
                }
            }

            // Put lesson to list
            if (lessons[lesson.date] == undefined) {
                lessons[lesson.date] = [ lesson ];
            } else {
                lessons[lesson.date].push(lesson);
            }
        }

        for (i in lessons) {
            // Sort list by start time
            lessons[i].sort((a, b) => a.startTime - b.startTime);

            // lessons starting at same time are put into the same array
            for (j = 0; j < lessons[i].length; ++ j) {
                if (lessonsTrimed[i] == undefined) {
                    lessonsTrimed[i] = [];
                }

                if (lessonsTrimed[i][idx] == undefined) {
                    lessonsTrimed[i][idx] = [lessons[i][j]];
                } else {
                    lessonsTrimed[i][idx].push(lessons[i][j]);
                }

                // if true, next lesson starts else there is another lesson starting at the same time
                if (j+1 < lessons[i].length && lessons[i][j].startTime != lessons[i][j+1].startTime) {
                    idx++;
                }
            }
        }

        return lessonsTrimed;
    },

    /* general function for sending a request */
    request: function(hostname, path, data, method, cookie = '') {
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Cookie': cookie,
            }
        }

        return new Promise(function(resolve, reject) {
            let content = "";
            const req = https.request(options, res => {
                res.setEncoding('utf8');
                res.on('data', data => content += data);
                res.on('end', _ => resolve({content: content, cookie: res.headers['set-cookie']}));
            });

            req.on('error', err => reject(err));
            req.write(data);
            req.end();
        });
    }
}

module.exports = Webuntis;
