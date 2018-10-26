"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.countreports = functions.database
  .ref("/reports/{reportId}")
  .onWrite((change, context) => {
    const collectionRef = change.after.ref.parent;
    const stats = collectionRef.parent.child("stats");
    const countRef = stats.ref.child("report-count");

    let increment,
      incValidated = {
        undef: 0,
        red: 0,
        green: 0
      },
      val;

    const incrementUndFn = function(current) {
      return (current || 0) + incValidated.undef;
    };
    const incrementRedFn = function(current) {
      return (current || 0) + incValidated.red;
    };
    const incrementGreenFn = function(current) {
      return (current || 0) + incValidated.green;
    };

    if (change.after.exists() && !change.before.exists()) {
      increment = 1;
      val = change.after.val();
      if (typeof val.validated === "undefined") {
        incValidated.undef = 1;
      } else if (val.validated === 1) {
        incValidated.red = 1;
      } else {
        incValidated.green = 1;
      }
      if (typeof val.location !== "undefined") {
        let locationData = {};
        locationData["/locations/" + context.params.reportId] = {
          date: val.date,
          lat: val.lat,
          lng: val.lng,
          location: val.location
        };
        collectionRef.parent.ref.update(locationData);
      }
    } else if (!change.after.exists() && change.before.exists()) {
      increment = -1;
      val = change.before.val();
      if (typeof val.validated === "undefined") {
        incValidated.undef = -1;
      } else if (val.validated === 1) {
        incValidated.red = -1;
      } else {
        incValidated.green = -1;
      }
      collectionRef.parent.ref
        .child("locations/" + context.params.reportId)
        .remove();
    } else {
      if (change.before.exists() && change.after.exists()) {
        let valb = change.before.val(),
          vala = change.after.val();
        if (typeof vala.location !== "undefined") {
          let locationData = {};
          locationData["/locations/" + context.params.reportId] = {
            date: vala.date,
            lat: vala.lat,
            lng: vala.lng,
            location: vala.location
          };
          collectionRef.parent.ref.update(locationData);
        } else {
          collectionRef.parent.ref
            .child("locations/" + context.params.reportId)
            .remove();
        }
        if (valb.validated !== vala.validated) {
          let key = collectionRef.parent.child("notifications").ref.push().key,
            data = {},
            aircrafts = Object.keys(vala.aircrafts).join(", ");
          const ayear = vala.date.split("-")[0];
          const byear = valb.date.split("-")[0];
          const acountDateUndefRef = stats.child(
            "reports-count-undef/" + ayear
          );
          const acountDateRedRef = stats.child("reports-count-red/" + ayear);
          const acountDateGreenRef = stats.child(
            "reports-count-green/" + ayear
          );
          const bcountDateUndefRef = stats.child(
            "reports-count-undef/" + byear
          );
          const bcountDateRedRef = stats.child("reports-count-red/" + byear);
          const bcountDateGreenRef = stats.child(
            "reports-count-green/" + byear
          );
          let bincValidated = {
            undef: 0,
            red: 0,
            green: 0
          };
          const bincrementUndefFn = function(current) {
            return (current || 0) + bincValidated.undef;
          };
          const bincrementRedFn = function(current) {
            return (current || 0) + bincValidated.red;
          };
          const bincrementGreenFn = function(current) {
            return (current || 0) + bincValidated.green;
          };
          if (typeof vala.validated === "undefined") {
            incValidated.undef = 1;
          } else if (vala.validated === 1) {
            incValidated.red = 1;
          } else {
            incValidated.green = 1;
          }
          if (typeof valb.validated === "undefined") {
            bincValidated.undef = -1;
          } else if (valb.validated === 1) {
            bincValidated.red = -1;
          } else {
            bincValidated.green = -1;
          }
          data["/notifications/" + key] = {
            date: admin.database.ServerValue.TIMESTAMP,
            report: context.params.reportId,
            oldValue: valb.validated || 0,
            newValue: vala.validated || 0,
            user: vala.user,
            aircrafts: aircrafts,
            reportDate: vala.date
          };

          return acountDateUndefRef
            .transaction(incrementUndFn)
            .then(() => {
              return acountDateRedRef.transaction(incrementRedFn);
            })
            .then(() => {
              return acountDateGreenRef.transaction(incrementGreenFn);
            })
            .then(() => {
              return bcountDateUndefRef.transaction(bincrementUndefFn);
            })
            .then(() => {
              return bcountDateRedRef.transaction(bincrementRedFn);
            })
            .then(() => {
              return bcountDateGreenRef.transaction(bincrementGreenFn);
            })
            .then(() => {
              return collectionRef.parent.ref.update(data);
            });
        }
      }
      return null;
    }

    const year = val.date.split("-")[0];
    const countDateRef = stats.child("reports-count/" + year);
    const countDateUndefRef = stats.child("reports-count-undef/" + year);
    const countDateRedRef = stats.child("reports-count-red/" + year);
    const countDateGreenRef = stats.child("reports-count-green/" + year);
    const countTypeRef = stats.child("occurrence-type-count-" + val.type);
    const countTypeDateRef = stats
      .child("occurrences-type-count-" + val.type)
      .ref.child(year);
    const incrementFn = function(current) {
      return (current || 0) + increment;
    };

    return countRef
      .transaction(incrementFn)
      .then(() => {
        return countDateRef.transaction(incrementFn);
      })
      .then(() => {
        return countTypeRef.transaction(incrementFn);
      })
      .then(() => {
        return countTypeDateRef.transaction(incrementFn);
      })
      .then(() => {
        return countDateUndefRef.transaction(incrementUndFn);
      })
      .then(() => {
        return countDateRedRef.transaction(incrementRedFn);
      })
      .then(() => {
        return countDateGreenRef.transaction(incrementGreenFn);
      });
  });
