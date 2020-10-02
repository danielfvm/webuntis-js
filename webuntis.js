/*
    Author: Daniel Schloegl
    Github: https://github.com/danielfvm
    Date:   30.09.2020

    Library to watch public lessons from webuntis.com
*/

const https = require('https')

const Webuntis = {
    findSchool: function(search) {
        const data = JSON.stringify({
            id: "wu_schulsuche-1601401688595",
            method: "searchSchool",
            params: [{search: search}],
            jsonrpc: "2.0"
        })

        return new Promise(function(resolve, reject) {
            Webuntis.request(
                'mobile.webuntis.com', 
                '/ms/schoolquery2', 
                data,
                'POST',
            ).then(res => {
                resolve(JSON.parse(res.content)["result"]["schools"]);
            }, err => reject(err));
        });
    },

    /* Sets cookie `schoolname` */
    setupCookie: function(school) {
        return new Promise(function(resolve, reject) {
            Webuntis.request(
                school.server, 
                `/WebUntis/?school=${school.loginName}#/basic/main`,
                '', 
                'GET',
            ).then(res => {
                school.cookie = res.cookie[1];
                resolve(school);
            }, err => reject(err));
        });
    },

    findDepartments: function(school) {
        if (school.cookie == undefined) {
            console.log("Forgot `setupCookie`?");
        }

        return new Promise(function(resolve, reject) {
            Webuntis.request(
                school.server, 
                '/WebUntis/api/public/timetable/weekly/pageconfig?type=1', 
                '', 
                'GET',
                school.cookie
            ).then(res => {
                let departments = JSON.parse(res.content).data.filters[0].elements;

                for (let i in departments) {
                    departments[i].school = school;
                }

                resolve(departments);
            }, err => reject(err));
        });
    },

    findClasses: function(department) {
        return new Promise(function(resolve, reject) {
            Webuntis.request(
                department.school.server, 
                `/WebUntis/api/public/timetable/weekly/pageconfig?type=1&filter.departmentId=${department.id}`, 
                '', 
                'GET',
                department.school.cookie
            ).then(res => {
                let classes = JSON.parse(res.content).data.elements;

                for (let i in classes) {
                    classes[i].department = department;
                }

                resolve(classes);
            }, err => reject(err));
        });
    },

    // https://stackoverflow.com/questions/23593052/format-javascript-date-as-yyyy-mm-dd
    getDate: function() {
        let d = new Date();
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join('-');
    },

    getTimetable: function(clazz) {
        let date = Webuntis.getDate();

        return new Promise(function(resolve, reject) {
            Webuntis.request(
                clazz.department.school.server, 
                `/WebUntis/api/public/timetable/weekly/data?type=1&date=${date}&elementType=1&elementId=${clazz.id}&filter.departmentId=${clazz.department.id}`, 
                '', 
                'GET',
                clazz.department.school.cookie
            ).then(res => {
                resolve(JSON.parse(res.content).data.result.data);
            }, err => reject(err));
        });
    },

    getElementFromTimetable: function(timetable, type, id) {
        let elements = timetable.elements;
        let i;

        for (i in elements) {
            if (elements[i].type == type && elements[i].id == id) {
                return elements[i];
            }
        }

        return null;
    },

    mapTimetableToWeek: function(timetable) {
        let elementPeriods = timetable.elementPeriods[Object.keys(timetable.elementPeriods)[0]];
        let elements = timetable.elements;
        let lessons = {};
        let i, j;

        for (i in elementPeriods) {
            let lesson = {
                date: elementPeriods[i].date,
                startTime: elementPeriods[i].startTime,
                name: null,
                room: null,
                teachers: [],
            };

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

            if (lessons[lesson.date] == undefined) {
                lessons[lesson.date] = [ lesson ];
            } else {
                lessons[lesson.date].push(lesson);
            }
        }

        for (i in lessons) {
            lessons[i].sort((a, b) => a.startTime - b.startTime);
        }

        return lessons;
    },

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
